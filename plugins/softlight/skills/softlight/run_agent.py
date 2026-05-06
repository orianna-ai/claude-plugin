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

_GENERATE_MOCK_REVISION_KEY_PREFIX = "generate_mock_revision:"


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


def _handle_prompt(
    config: Config,
    prompt: dict[str, Any],
) -> None:
    prompt_key = str(prompt.get("key") or "")
    if prompt_key.startswith(_GENERATE_MOCK_REVISION_KEY_PREFIX):
        print(
            "Skipping internal mock revision prompt "
            f"project_id={config.project_id} prompt_key={prompt_key}",
            flush=True,
        )
        return

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


def _prompt_id(
    prompt: dict[str, Any],
) -> str | None:
    prompt_id = prompt.get("metadata", {}).get("id")
    if prompt_id is None:
        return None

    return str(prompt_id)


def _completed_prompt_ids(
    events: list[dict[str, Any]],
) -> set[str]:
    return {
        str(event["prompt_id"])
        for event in events
        if event.get("type")
        in {"prompt_succeeded", "prompt_failed", "prompt_completed"}
        and event.get("prompt_id") is not None
    }


def _should_dispatch_prompt(
    prompt: dict[str, Any],
    *,
    completed_prompt_ids: set[str],
    submitted_prompt_ids: set[str],
) -> bool:
    prompt_key = str(prompt.get("key") or "")
    if prompt_key.startswith(_GENERATE_MOCK_REVISION_KEY_PREFIX):
        return False

    prompt_id = _prompt_id(prompt)
    if prompt_id is not None and prompt_id in completed_prompt_ids:
        return False
    if prompt_id is not None and prompt_id in submitted_prompt_ids:
        return False

    return True


def _dispatch_prompts(
    config: Config,
) -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0
        submitted_prompt_ids: set[str] = set()

        while True:
            events = _fetch_events(config)
            completed_prompt_ids = _completed_prompt_ids(events)

            if len(events) > cursor:
                for event in events[cursor:]:
                    if event.get("type") != "prompt_created":
                        continue

                    prompt = event["prompt"]
                    if not _should_dispatch_prompt(
                        prompt,
                        completed_prompt_ids=completed_prompt_ids,
                        submitted_prompt_ids=submitted_prompt_ids,
                    ):
                        continue

                    if prompt_id := _prompt_id(prompt):
                        submitted_prompt_ids.add(prompt_id)

                    executor.submit(
                        _handle_prompt,
                        config,
                        prompt,
                    )

                cursor = len(events)

            time.sleep(5)

            post_transcripts(config)


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
