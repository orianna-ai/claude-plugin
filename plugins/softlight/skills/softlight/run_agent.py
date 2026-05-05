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


def _created_at(
    value: dict[str, Any],
) -> datetime.datetime:
    if created_at := value.get("metadata", {}).get("created_at"):
        return datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    else:
        return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)


def _mock_slot_status(
    element: dict[str, Any] | None,
) -> str | None:
    if not isinstance(element, dict):
        return None

    element_type = element.get("type")
    if element_type == "image":
        return "loaded" if str(element.get("url") or "").strip() else "loading"
    if element_type == "placeholder":
        return "loading"
    if element_type == "error":
        return "failed"

    return None


def _is_mock_generation_prompt(
    prompt: dict[str, Any],
) -> bool:
    return prompt.get("workflow") == "generate_mocks" or str(
        prompt.get("key") or "",
    ).startswith("generate_mock_revision:")


def _mock_generation_state(
    *,
    events: list[dict[str, Any]],
    project: dict[str, Any],
    since: datetime.datetime,
) -> dict[str, Any]:
    touched_slots: dict[str, dict[str, Any]] = {}
    mock_prompt_ids = {
        prompt.get("metadata", {}).get("id")
        for prompt in project.get("prompts") or []
        if _is_mock_generation_prompt(prompt)
    }
    failures: list[dict[str, Any]] = []

    for event in events:
        if _created_at(event) <= since:
            continue

        event_type = event.get("type")
        if event_type == "prompt_failed" and event.get("prompt_id") in mock_prompt_ids:
            failures.append(
                {
                    "event_type": event_type,
                    "event_created_at": event.get("metadata", {}).get("created_at"),
                    "prompt_id": event.get("prompt_id"),
                    "status": "failed",
                },
            )
            continue

        if event_type not in {"slot_created", "slot_updated"}:
            continue

        slot = event.get("slot") or {}
        slot_id = (
            slot.get("metadata", {}).get("id")
            if event_type == "slot_created"
            else event.get("slot_id")
        )
        if slot_id is None:
            continue

        touched_slots[str(slot_id)] = {
            "event_type": event_type,
            "event_created_at": event.get("metadata", {}).get("created_at"),
            "slot_id": str(slot_id),
        }

    current_slots = {
        str(slot.get("metadata", {}).get("id")): slot
        for revision in project.get("revisions") or []
        for slot in revision.get("slots") or []
        if slot.get("metadata", {}).get("id") is not None
    }
    slot_updates = []
    for slot_id, update in touched_slots.items():
        status = _mock_slot_status((current_slots.get(slot_id) or {}).get("element"))
        if status is not None:
            slot_updates.append({**update, "status": status})

    statuses = sorted(
        {update["status"] for update in slot_updates}
        | {failure["status"] for failure in failures},
    )

    return {
        "since_discussion_created_at": since.isoformat(),
        "statuses": statuses,
        "slot_updates": slot_updates,
        "failures": failures,
        "has_loading": "loading" in statuses,
        "has_loaded": "loaded" in statuses,
        "has_failed": "failed" in statuses,
    }


def _steer_conversation(
    config: Config,
) -> None:
    while True:
        project = get_project(config)
        events = _fetch_events(config)

        discussion = project.get("discussion") or {}
        discussion_created_at = _created_at(discussion)

        proposed_discussions = [
            proposed_dicussion
            for proposed_dicussion in project.get("proposed_discussions") or []
            if not discussion or _created_at(proposed_dicussion) > discussion_created_at
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

<mock_generation_state>
${mock_generation_state}
</mock_generation_state>
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
                "mock_generation_state": json.dumps(
                    _mock_generation_state(
                        events=events,
                        project=project,
                        since=discussion_created_at,
                    ),
                    indent=2,
                ),
            },
            config=config,
            effort="medium",
            fork_session=False,
            model="sonnet",
            session_id=f"steering_manager:{uuid.uuid4()}",
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
