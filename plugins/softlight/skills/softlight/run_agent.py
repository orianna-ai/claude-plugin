from __future__ import annotations

import argparse
import concurrent.futures
import json
import time
import traceback
import urllib.request
from typing import Any

from scripts.load_config import Config, load_config
from scripts.post_events import post_events
from scripts.post_transcripts import post_transcripts
from scripts.spawn_reaper import spawn_reaper
from workflows.base import WORKFLOWS


def _fetch_events(
    config: Config,
) -> list[dict[str, Any]]:
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                f"{config.base_url}/api/projects/{config.project_id}/events",
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "claude-code",
                },
            ),
            timeout=10,
        ) as response:
            return json.loads(response.read())
    except Exception:
        traceback.print_exc()

        return []


def _get_pending_prompts(
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    completed_prompts = {
        event["prompt_id"]
        for event in events
        if event.get("type") == "prompt_succeeded"
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


def _dispatch_prompts(
    config: Config,
) -> None:
    post_events(
        config=config,
        events=[
            {
                "type": "heartbeat",
            },
        ],
    )

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
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

            time.sleep(5)

            post_transcripts(config)

            post_events(
                config=config,
                events=[
                    {
                        "type": "heartbeat",
                    },
                ],
            )


def run_agent(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        executor.submit(_dispatch_prompts, config)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    run_agent(
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
