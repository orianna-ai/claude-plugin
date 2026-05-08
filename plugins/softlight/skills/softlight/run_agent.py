from __future__ import annotations

import argparse
import concurrent.futures
import json
import time
import traceback
import urllib.request
import uuid
from typing import Any

from scripts.call_claude import call_claude
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.load_config import Config, load_config
from scripts.post_events import post_events
from scripts.post_transcripts import post_transcripts
from scripts.run_app import run_app
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


def _emit_heartbeats(
    config: Config,
) -> None:
    while True:
        post_events(
            config=config,
            events=[
                {
                    "type": "heartbeat",
                },
            ],
        )

        time.sleep(30)


def _upload_transcripts(
    config: Config,
) -> None:
    while True:
        time.sleep(10)

        post_transcripts(config)


def _update_prototype(
    config: Config,
) -> None:
    prototype_dir = create_app()

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "prototype_dir": str(prototype_dir),
            },
        ],
    )

    time.sleep(30)

    project = get_project(config)

    call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-prototype` skill.

<conversations>${conversations}</conversations>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
        ],
        params={
            "prototype_dir": str(prototype_dir),
            "conversations": json.dumps(project["conversations"], indent=2),
        },
        model="opus",
        effort="low",
        session_id="generate_prototype",
    )

    tunnel_id = str(uuid.uuid4())

    run_app(
        config=config,
        source_code_dir=prototype_dir,
        tunnel_id=tunnel_id,
    )

    post_events(
        config=config,
        events=[
            {
                "type": "slot_created",
                "slot": {
                    "element": {
                        "type": "iframe",
                        "source_code_dir": str(prototype_dir),
                        "tunnel_id": tunnel_id,
                    },
                    "x": 0,
                    "y": 0,
                    "width": 1720,
                    "height": 1120,
                },
            },
        ],
    )

    while True:
        project = get_project(config)

        call_claude(
            config=config,
            prompt=[
                """\
Call the `edit-prototype` skill.

<conversations>${conversations}</conversations>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
            ],
            params={
                "prototype_dir": str(prototype_dir),
                "conversations": json.dumps(project["conversations"], indent=2),
            },
            model="opus",
            effort="low",
            session_id="generate_prototype",
        )

        tunnel_id = str(uuid.uuid4())

        run_app(
            config=config,
            source_code_dir=prototype_dir,
            tunnel_id=tunnel_id,
        )

        post_events(
            config=config,
            events=[
                {
                    "type": "slot_created",
                    "slot": {
                        "element": {
                            "type": "iframe",
                            "source_code_dir": str(prototype_dir),
                            "screenshots": [],
                            "tunnel_id": tunnel_id,
                        },
                        "x": 0,
                        "y": 0,
                        "width": 1720,
                        "height": 1120,
                    },
                },
            ],
        )


def run_agent(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        executor.submit(_dispatch_prompts, config)
        executor.submit(_emit_heartbeats, config)
        executor.submit(_upload_transcripts, config)
        executor.submit(_update_prototype, config)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    run_agent(
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
