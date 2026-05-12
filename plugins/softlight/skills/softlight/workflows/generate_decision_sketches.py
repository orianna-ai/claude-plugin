import html
import json
import math
import uuid
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow

_SKETCH_WIDTH = 760.0
_SKETCH_HEIGHT = 520.0
_SKETCH_GAP = 80.0
_TITLE_HEIGHT = 120.0
_CAPTION_HEIGHT = 120.0
_ROW_GAP = 64.0
_REVISION_GAP = 800.0
_GRID_SIZE = 40.0


class GenerateDecisionSketchesParams(TypedDict):
    decisionId: str
    runId: str


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


def _canvas_bottom(project: dict[str, Any]) -> float:
    bottom = 0.0
    for revision in project.get("revisions") or []:
        for slot in revision.get("slots") or []:
            x = float(slot.get("x") or 0)
            y = float(slot.get("y") or 0)
            if x < -90000 or y < -90000:
                continue
            bottom = max(bottom, y + float(slot.get("height") or 0))
    if bottom == 0:
        return 0.0
    return math.ceil((bottom + _REVISION_GAP) / _GRID_SIZE) * _GRID_SIZE


def _decision_by_id(project: dict[str, Any], decision_id: str) -> dict[str, Any]:
    for decision in project.get("decisions") or []:
        if decision.get("id") == decision_id:
            return decision
    raise ValueError(f"decision {decision_id!r} does not exist")


def _wrap_sketch_html(body: str, title: str) -> str:
    if "<html" in body.lower():
        return body
    return f"""\
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(title)}</title>
  </head>
  <body>
{body}
  </body>
</html>
"""


@workflow
def generate_decision_sketches(
    config: Config,
    params: GenerateDecisionSketchesParams,
) -> None:
    """Generate fast lo-fi HTML sketches for the active decision."""
    decision_id = params["decisionId"]
    run_id = params["runId"]
    project = get_project(config=config)
    decision = _decision_by_id(project, decision_id)
    transcript = _conversation_transcript(project)
    base_y = _canvas_bottom(project)
    row_width = 3 * _SKETCH_WIDTH + 2 * _SKETCH_GAP

    title_slot_id = str(uuid.uuid4())
    sketch_slot_ids = [str(uuid.uuid4()) for _ in range(3)]
    caption_slot_ids = [str(uuid.uuid4()) for _ in range(3)]

    post_events(
        config=config,
        events=[
            {"type": "revision_created", "revision": {}},
            {
                "type": "slot_created",
                "slot": {
                    "metadata": {"id": title_slot_id},
                    "element": {
                        "type": "text",
                        "variant": "h2",
                        "bold": True,
                        "text": decision["open_question"],
                    },
                    "width": row_width,
                    "height": _TITLE_HEIGHT,
                    "x": 0,
                    "y": base_y,
                },
            },
            *[
                {
                    "type": "slot_created",
                    "slot": {
                        "metadata": {"id": sketch_slot_id},
                        "element": {
                            "type": "html",
                            "html": "",
                        },
                        "width": _SKETCH_WIDTH,
                        "height": _SKETCH_HEIGHT,
                        "x": index * (_SKETCH_WIDTH + _SKETCH_GAP),
                        "y": base_y + _TITLE_HEIGHT + _ROW_GAP,
                    },
                }
                for index, sketch_slot_id in enumerate(sketch_slot_ids)
            ],
            *[
                {
                    "type": "slot_created",
                    "slot": {
                        "metadata": {"id": caption_slot_id},
                        "references": [
                            {"type": "slot", "slot_id": sketch_slot_ids[index]},
                        ],
                        "element": {
                            "type": "placeholder",
                            "content_type": "text",
                        },
                        "width": _SKETCH_WIDTH,
                        "height": _CAPTION_HEIGHT,
                        "x": index * (_SKETCH_WIDTH + _SKETCH_GAP),
                        "y": base_y
                        + _TITLE_HEIGHT
                        + _ROW_GAP
                        + _SKETCH_HEIGHT
                        + _ROW_GAP,
                    },
                }
                for index, caption_slot_id in enumerate(caption_slot_ids)
            ],
        ],
    )

    result = call_claude(
        prompt=[
            """\
Call the `generate-decision-sketches` skill.

Return structured output matching the provided JSON schema.

<decision>
${decision}
</decision>

<transcript>
${transcript}
</transcript>
""",
        ],
        params={
            "decision": json.dumps(decision, indent=2),
            "transcript": transcript,
        },
        config=config,
        effort="low",
        json_schema={
            "type": "object",
            "properties": {
                "follow_up_questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 5,
                },
                "sketches": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "html": {"type": "string"},
                            "caption": {"type": "string"},
                        },
                        "required": ["title", "html", "caption"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["follow_up_questions", "sketches"],
            "additionalProperties": False,
        },
        model="sonnet",
        session_id=f"generate_decision_sketches:{decision_id}:{run_id}",
    )

    sketch_events: list[dict[str, Any]] = []
    for index, sketch in enumerate(result["sketches"]):
        sketch_events.append(
            {
                "type": "slot_updated",
                "slot_id": sketch_slot_ids[index],
                "element": {
                    "type": "html",
                    "html": _wrap_sketch_html(
                        str(sketch["html"]),
                        str(sketch["title"]),
                    ),
                },
            },
        )
        sketch_events.append(
            {
                "type": "slot_updated",
                "slot_id": caption_slot_ids[index],
                "element": {
                    "type": "text",
                    "variant": "p",
                    "bold": False,
                    "text": f"**{sketch['title']}**\n\n{sketch['caption']}",
                },
            },
        )

    sketch_events.append(
        {
            "type": "prompt_progress",
            "prompt_id": run_id,
            "result": {
                "decision_id": decision_id,
                "follow_up_questions": result.get("follow_up_questions") or [],
                "sketches_ready": True,
            },
        },
    )

    post_events(config=config, events=sketch_events)
