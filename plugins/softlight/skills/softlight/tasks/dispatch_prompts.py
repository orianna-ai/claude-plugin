import concurrent.futures
import json
import time
import traceback
import urllib.request
from typing import Any

from scripts.load_config import Config
from scripts.post_events import post_events
from workflows.base import WORKFLOWS

from tasks.base import task

# duration to wait between event queries
_POLL_INTERVAL = 5


# maximum number of prompts that can be run in parallel
_MAX_CONCURRENT_PROMPTS = 8


def _fetch_events(
    config: Config,
) -> list[dict[str, Any]]:
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{config.base_url}/api/projects/{config.project_id}/events",
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code",
            },
        ),
        timeout=30,
    ) as response:
        return json.loads(response.read())


def _get_pending_prompts(
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    completed_prompts = {
        event["prompt_id"] for event in events if event.get("type") == "prompt_succeeded"
    }

    pending_prompts = [
        event["prompt"]
        for event in events
        if event.get("type") == "prompt_created"
        if event["prompt"]["metadata"]["id"] not in completed_prompts
        # HACK: ignore the synthetic generate_mock_revision prompts
        if not event["prompt"]["key"].startswith("generate_mock_revision:")
    ]

    return pending_prompts


def _handle_prompt(
    config: Config,
    prompt: dict[str, Any],
) -> None:
    try:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_started",
                    "prompt_id": prompt["metadata"]["id"],
                },
            ],
        )

        if workflow := WORKFLOWS.get(prompt["workflow"]):
            workflow.call(config, prompt.get("params") or {})
        else:
            raise ValueError(f"workflow {prompt['workflow']} does not exist")
    except Exception:
        traceback.print_exc()

        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_failed",
                    "prompt_id": prompt["metadata"]["id"],
                    "error": traceback.format_exc(),
                },
            ],
        )
    else:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_succeeded",
                    "prompt_id": prompt["metadata"]["id"],
                },
            ],
        )


@task()
def dispatch_prompts(
    config: Config,
) -> None:
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=_MAX_CONCURRENT_PROMPTS,
    ) as executor:
        cursor = 0

        while True:
            events = _fetch_events(config)

            if len(events) > cursor:
                for prompt in _get_pending_prompts(events[cursor:]):
                    executor.submit(
                        _handle_prompt,
                        config,
                        prompt,
                    )

                cursor = len(events)

            time.sleep(_POLL_INTERVAL)
