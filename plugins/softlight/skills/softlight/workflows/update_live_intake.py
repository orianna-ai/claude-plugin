import json
import uuid

from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow


def _live_intake_context(
    events: list[dict],
) -> dict:
    transcript = []
    seen_turn_ids: set[str] = set()
    screenshots = []
    seen_screenshot_urls: set[str] = set()

    for event in events:
        if event.get("type") == "intake_transcript_turn_added":
            turn_id = event["turn_id"]
            if turn_id in seen_turn_ids:
                continue

            seen_turn_ids.add(turn_id)
            transcript.append(
                {
                    "role": event["role"],
                    "text": event["text"],
                    "turn_id": event["turn_id"],
                    "timestamp_ms": event["timestamp_ms"],
                },
            )
        elif event.get("type") == "intake_screenshot_captured":
            url = event["url"]
            if url in seen_screenshot_urls:
                continue

            seen_screenshot_urls.add(url)
            screenshots.append(
                {
                    "caption": event["caption"],
                    "timestamp": event["timestamp"],
                    "url": event["url"],
                },
            )

    latest_state = next(
        (
            event.get("state") or {}
            for event in reversed(events)
            if event.get("type") == "intake_state_updated"
        ),
        {},
    )

    return {
        "latest_state": latest_state,
        "screenshots": screenshots,
        "transcript": transcript,
    }


@workflow
def update_live_intake(
    config: Config,
    params: dict[str, str],
) -> None:
    run_id = params.get("run_id") or uuid.uuid4().hex
    events = json.loads(params.get("events", "[]"))
    context = _live_intake_context(events)

    call_claude(
        prompt="""\
Use the `live-intake-manager` skill to update the live intake state for Softlight project
${project_id}.

<latest_state>
${latest_state}
</latest_state>

<screenshots>
${screenshots}
</screenshots>

<transcript>
${transcript}
</transcript>
""",
        params={
            "project_id": config.project_id,
            "latest_state": json.dumps(context["latest_state"], indent=2),
            "screenshots": json.dumps(context["screenshots"], indent=2),
            "transcript": json.dumps(context["transcript"], indent=2),
        },
        config=config,
        effort="low",
        model="opus",
        session_id=f"live_intake:{run_id}",
    )
