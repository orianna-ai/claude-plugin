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

with urllib.request.urlopen(
    urllib.request.Request(
        "https://softlight.orianna.ai/api/projects/e3969905-3d7a-4a14-84b9-5a33cb105227/events",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "claude-code",
        },
    ),
    timeout=10,
) as response:
    print(response.read())


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
    try:
        if workflow := WORKFLOWS.get(prompt["workflow"]):
            workflow(config, prompt.get("params") or {})
        else:
            raise ValueError(f"workflow {prompt['workflow']} does not exist")
    except Exception:
        traceback.print_exc()

        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_completed",
                    "prompt_id": prompt["metadata"]["id"],
                    "status": "failure",
                },
            ],
        )
    else:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_completed",
                    "prompt_id": prompt["metadata"]["id"],
                    "status": "success",
                },
            ],
        )


def dispatch_prompts(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0

        while True:
            events = _fetch_events(config)

            if len(events) > cursor:
                for event in events[cursor:]:
                    if event.get("type") == "prompt_created":
                        executor.submit(
                            _handle_prompt,
                            config,
                            event["prompt"],
                        )

                cursor = len(events)

            time.sleep(10)

            post_transcripts(config)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    dispatch_prompts(
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
