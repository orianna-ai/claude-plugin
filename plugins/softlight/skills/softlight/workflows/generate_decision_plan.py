import json
import uuid
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow


class GenerateDecisionPlanParams(TypedDict, total=False):
    mode: str
    runId: str


_DECISION_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "decisions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "open_question": {"type": "string", "minLength": 1},
                    "subtext": {"type": "string", "minLength": 1},
                    "sketch_prompt_context": {"type": "string"},
                },
                "required": [
                    "open_question",
                    "subtext",
                    "sketch_prompt_context",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["decisions"],
    "additionalProperties": False,
}


def _conversation_transcript(project: dict[str, Any]) -> str:
    lines: list[str] = []
    for conversation in project.get("conversations") or []:
        for message in conversation.get("messages") or []:
            text = " ".join(str(message.get("text") or "").split())
            if not text:
                continue
            role = "PM" if message.get("role") == "user" else "Facilitator"
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def _screenshots(project: dict[str, Any]) -> list[dict[str, Any]]:
    screenshots: list[dict[str, Any]] = []
    seen: set[str] = set()
    for conversation in project.get("conversations") or []:
        for screenshot in conversation.get("screenshots") or []:
            url = ((screenshot.get("image") or {}).get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            screenshots.append(
                {
                    "url": url,
                    "caption": screenshot.get("caption"),
                    "timestamp": screenshot.get("timestamp"),
                    "room": conversation.get("room"),
                },
            )
    return screenshots


def _next_decision_id(existing_decisions: list[dict[str, Any]]) -> str:
    used = {str(decision.get("id") or "") for decision in existing_decisions}
    for index in range(1, len(used) + 8):
        candidate = f"decision-{index}"
        if candidate not in used:
            return candidate
    return f"decision-{uuid.uuid4().hex[:8]}"


@workflow
def generate_decision_plan(
    config: Config,
    params: GenerateDecisionPlanParams,
) -> None:
    """Generate the ordered decision list for a decision-led intake canvas."""
    run_id = params.get("runId") or str(uuid.uuid4())
    mode = params.get("mode") or "initial"
    project = get_project(config=config)
    transcript = _conversation_transcript(project)
    screenshots = _screenshots(project)
    existing_decisions = project.get("decisions") or []

    result = call_claude(
        prompt=[
            """\
Call the `generate-decision-plan` skill.

Return structured output matching the provided JSON schema.

<project_id>${project_id}</project_id>
<mode>${mode}</mode>
<transcript>
${transcript}
</transcript>

The screenshots below are captured frames from what the PM/founder screenshared during the intake.
Use the attached image blocks as context for the current product surface and workflow.

<existing_decisions>
${existing_decisions}
</existing_decisions>
""",
            *(
                {
                    "type": "image",
                    "source": {"type": "url", "url": screenshot["url"]},
                }
                for screenshot in screenshots
            ),
        ],
        params={
            "project_id": config.project_id,
            "mode": mode,
            "transcript": transcript,
            "existing_decisions": json.dumps(existing_decisions, indent=2),
        },
        config=config,
        effort="low",
        json_schema=_DECISION_PLAN_SCHEMA,
        model="opus",
        session_id="generate_decision_plan",
    )

    decisions: list[dict[str, Any]] = []
    if mode == "next":
        decisions.extend(
            decision for decision in existing_decisions if decision.get("status") == "resolved"
        )
        next_decision = result["decisions"][0]
        next_decision_id = _next_decision_id(existing_decisions)
        decisions.append(
            {
                "id": next_decision_id,
                "open_question": str(next_decision["open_question"]).strip(),
                "subtext": str(next_decision["subtext"]).strip(),
                "sketch_prompt_context": str(
                    next_decision.get("sketch_prompt_context") or "",
                ).strip(),
                "status": "active",
            },
        )
    else:
        first_decision = result["decisions"][0]
        decisions.append(
            {
                "id": "decision-1",
                "open_question": str(first_decision["open_question"]).strip(),
                "subtext": str(first_decision["subtext"]).strip(),
                "sketch_prompt_context": str(
                    first_decision.get("sketch_prompt_context") or "",
                ).strip(),
                "status": "active",
            },
        )

    events: list[dict[str, Any]] = [
        {
            "type": "decision_mode_started",
        },
        {
            "type": "decision_list_updated",
            "decisions": decisions,
        },
    ]

    active_decision = next(
        (decision for decision in decisions if decision.get("status") == "active"),
        None,
    )
    if active_decision:
        sketch_run_id = str(uuid.uuid4())
        events.append(
            {
                "type": "prompt_created",
                "metadata": {"id": sketch_run_id},
                "prompt": {
                    "key": f"generate_decision_sketches:{active_decision['id']}",
                    "params": {
                        "decisionId": active_decision["id"],
                        "runId": sketch_run_id,
                    },
                    "workflow": "generate_decision_sketches",
                },
            },
        )

    post_events(config=config, events=events)
