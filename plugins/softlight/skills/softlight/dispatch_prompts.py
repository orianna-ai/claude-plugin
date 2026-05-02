import argparse
import concurrent.futures
import json
import time
import traceback
import urllib.request
import uuid
from typing import Any

from scripts.load_config import Config, load_config
from scripts.post_events import post_events
from scripts.post_transcripts import post_transcripts
from scripts.spawn_reaper import spawn_reaper
from workflows.base import WORKFLOWS

LIVE_INTAKE_INTERVAL_SECONDS = 20
LIVE_INTAKE_USER_TURN_BATCH_SIZE = 3
POLL_INTERVAL_SECONDS = 5


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
            workflow(
                config,
                {
                    **(prompt.get("params") or {}),
                    "_prompt_id": prompt["metadata"]["id"],
                },
            )
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


def _live_intake_transcript(
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen_turn_ids: set[str] = set()
    transcript = []

    for event in events:
        if event.get("type") != "intake_transcript_turn_added":
            continue

        turn_id = event["turn_id"]
        if turn_id in seen_turn_ids:
            continue

        seen_turn_ids.add(turn_id)
        transcript.append(
            {
                "role": event["role"],
                "text": event["text"],
                "turn_id": turn_id,
                "timestamp_ms": event["timestamp_ms"],
            },
        )

    return transcript


def _latest_live_intake_revision(
    events: list[dict[str, Any]],
) -> int:
    revisions = [
        event["state"]["revision"]
        for event in events
        if event.get("type") == "intake_state_updated" and event.get("state")
    ]
    return max(revisions, default=0)


def _handle_live_intake(
    config: Config,
    *,
    transcript: list[dict[str, Any]],
    revision: int,
    run_id: str,
) -> None:
    WORKFLOWS["update_live_intake"](
        config,
        {
            "reason": "transcript_update",
            "revision": str(revision),
            "run_id": run_id,
            "transcript": json.dumps(transcript),
        },
    )


def dispatch_prompts(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0
        live_intake_future: concurrent.futures.Future[None] | None = None
        last_live_intake_at = 0.0
        last_live_intake_user_turn_count = 0

        while True:
            events = _fetch_events(config)

            if live_intake_future is not None and live_intake_future.done():
                try:
                    live_intake_future.result()
                except Exception:
                    traceback.print_exc()
                    last_live_intake_user_turn_count = 0
                finally:
                    live_intake_future = None

            if len(events) > cursor:
                for event in events[cursor:]:
                    if event.get("type") == "prompt_created":
                        executor.submit(
                            _handle_prompt,
                            config,
                            event["prompt"],
                        )

                cursor = len(events)

            transcript = _live_intake_transcript(events)
            user_turn_count = sum(1 for turn in transcript if turn["role"] == "user")
            has_new_user_turns = user_turn_count > last_live_intake_user_turn_count
            enough_new_user_turns = (
                user_turn_count - last_live_intake_user_turn_count
                >= LIVE_INTAKE_USER_TURN_BATCH_SIZE
            )
            stale_enough = (
                time.monotonic() - last_live_intake_at >= LIVE_INTAKE_INTERVAL_SECONDS
            )

            if (
                transcript
                and has_new_user_turns
                and live_intake_future is None
                and (last_live_intake_at == 0.0 or enough_new_user_turns or stale_enough)
            ):
                live_intake_future = executor.submit(
                    _handle_live_intake,
                    config,
                    transcript=transcript,
                    revision=_latest_live_intake_revision(events) + 1,
                    run_id=uuid.uuid4().hex,
                )
                last_live_intake_at = time.monotonic()
                last_live_intake_user_turn_count = user_turn_count

            time.sleep(POLL_INTERVAL_SECONDS)

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
