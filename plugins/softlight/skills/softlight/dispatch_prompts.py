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

_POLL_INTERVAL_SECONDS = 5
_STEERING_INTERVAL_SECONDS = 15


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


def _parse_created_at(
    value: str | None,
) -> datetime.datetime | None:
    if not value:
        return None

    try:
        return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _discussion_created_at(
    discussion: dict[str, Any] | None,
) -> datetime.datetime | None:
    if not discussion:
        return None

    metadata = discussion.get("metadata") or {}

    return _parse_created_at(metadata.get("created_at"))


def _new_proposed_discussions(
    project: dict[str, Any],
    *,
    after: datetime.datetime | None,
) -> list[dict[str, Any]]:
    return [
        discussion
        for discussion in project.get("proposed_discussions") or []
        if after is None
        or (
            _discussion_created_at(discussion)
            or datetime.datetime.min.replace(tzinfo=datetime.UTC)
        )
        > after
    ]


def _conversation_transcripts(
    conversations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        {
            "room": conversation.get("room"),
            "messages": conversation.get("messages") or [],
        }
        for conversation in conversations
    ]


def _handle_steering_manager(
    config: Config,
) -> None:
    project = get_project(config)
    current_discussion = project.get("discussion") or {}
    current_discussion_created_at = _discussion_created_at(current_discussion)
    proposed_discussions = _new_proposed_discussions(
        project,
        after=current_discussion_created_at,
    )

    conversations = _conversation_transcripts(project.get("conversations") or [])
    print(
        "dispatch_prompts: steering manager running "
        f"(pending={len(proposed_discussions)})",
        flush=True,
    )

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
            "latest_state": json.dumps(current_discussion, indent=2),
            "conversations": json.dumps(conversations, indent=2),
            "agent_updates": json.dumps(proposed_discussions, indent=2),
        },
        config=config,
        effort="low",
        fork_session=False,
        model="opus",
        session_id=f"steering_manager:{uuid.uuid4()}",
    )


def dispatch_prompts(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0
        last_steering_at = 0.0
        steering_future: concurrent.futures.Future[None] | None = None

        while True:
            events = _fetch_events(config)

            if steering_future is not None and steering_future.done():
                try:
                    steering_future.result()
                except Exception:
                    traceback.print_exc()
                finally:
                    steering_future = None

            if len(events) > cursor:
                for event in events[cursor:]:
                    if event.get("type") == "prompt_created":
                        executor.submit(
                            _handle_prompt,
                            config,
                            event["prompt"],
                        )

                cursor = len(events)

            if (
                steering_future is None
                and time.monotonic() - last_steering_at >= _STEERING_INTERVAL_SECONDS
            ):
                steering_future = executor.submit(
                    _handle_steering_manager,
                    config,
                )
                last_steering_at = time.monotonic()

            time.sleep(_POLL_INTERVAL_SECONDS)

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
