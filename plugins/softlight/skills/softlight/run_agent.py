from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import json
import time
import traceback
import urllib.request
import uuid
from typing import Any

from scripts.call_claude import call_claude
from scripts.get_project import get_project
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
                for event in events[cursor:]:
                    if event.get("type") == "prompt_created":
                        executor.submit(
                            _handle_prompt,
                            config,
                            event["prompt"],
                        )

                cursor = len(events)

            time.sleep(5)

            post_transcripts(config)


def _created_at(
    value: dict[str, Any],
) -> datetime.datetime:
    if created_at := value.get("metadata", {}).get("created_at"):
        return datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    else:
        return datetime.datetime.min.replace(tzinfo=datetime.UTC)


def _steer_conversation(
    config: Config,
) -> None:
    while True:
        project = get_project(config)

        discussion = project.get("discussion") or {}

        proposed_discussions = [
            proposed_dicussion
            for proposed_dicussion in project.get("proposed_discussions") or []
            if not discussion
            or _created_at(proposed_dicussion) > _created_at(discussion)
        ]

        call_claude(
            prompt=[
                """\
Use the `steering-manager` skill to coalesce pending discussion updates for Softlight project
${project_id}.

<latest_state>
${latest_state}
</latest_state>

<conversations>
${conversations}
</conversations>

<agent_updates>
${agent_updates}
</agent_updates>
""",
            ],
            params={
                "project_id": config.project_id,
                "latest_state": json.dumps(discussion, indent=2),
                "conversations": json.dumps(
                    [
                        {
                            "room": conversation.get("room"),
                            "messages": conversation.get("messages") or [],
                        }
                        for conversation in project.get("conversations") or []
                    ],
                    indent=2,
                ),
                "agent_updates": json.dumps(proposed_discussions, indent=2),
            },
            config=config,
            effort="medium",
            fork_session=False,
            model="sonnet",
            session_id=f"steering_manager:{uuid.uuid4()}",
        )

        time.sleep(15)


def run_agent(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        executor.submit(_dispatch_prompts, config)
        executor.submit(_steer_conversation, config)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    run_agent(
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
