import concurrent.futures
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

_SKETCH_WIDTH = 1720
_SKETCH_HEIGHT = 1120
_SKETCH_GAP = 120
_TITLE_HEIGHT = 120.0
_CAPTION_HEIGHT = 120.0
_ROW_GAP = 64.0
_REVISION_GAP = 800.0
_GRID_SIZE = 40.0
_SKETCH_PARALLELISM = 4


class GenerateDecisionParams(TypedDict, total=False):
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
                    "tradeoffs": {
                        "type": "array",
                        "minItems": 3,
                        "maxItems": 3,
                        "items": {"type": "string", "minLength": 1},
                    },
                    "follow_up_questions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 5,
                    },
                },
                "required": [
                    "open_question",
                    "subtext",
                    "sketch_prompt_context",
                    "tradeoffs",
                    "follow_up_questions",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["decisions"],
    "additionalProperties": False,
}


_DECISION_SKETCH_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "html": {"type": "string"},
        "caption": {"type": "string"},
    },
    "required": ["title", "html", "caption"],
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


def _next_decision_id(existing_decisions: list[dict[str, Any]]) -> str:
    used = {str(decision.get("id") or "") for decision in existing_decisions}
    for index in range(1, len(used) + 8):
        candidate = f"decision-{index}"
        if candidate not in used:
            return candidate
    return f"decision-{uuid.uuid4().hex[:8]}"


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


def _generate_sketch(
    *,
    config: Config,
    decision: dict[str, Any],
    tradeoff: str,
    transcript: str,
    screenshots: list[dict[str, Any]],
    sketch_slot_id: str,
    caption_slot_id: str,
    session_id: str,
) -> None:
    result = call_claude(
        prompt=[
            """\
You are a senior product designer using a quick sketch to help a PM/founder clarify one active
decision. The sketch is a conversation probe, not a polished design.

## Inputs

You will receive:

- `decision`: the active decision, including `open_question`, `subtext`, and
  `sketch_prompt_context`.
- `tradeoff`: a short description of the specific product/workflow tradeoff this sketch must
  visualize. You will be called in parallel with sibling invocations covering different tradeoffs
  for the same decision — do not try to cover every angle, just commit to this one.
- `transcript`: the live conversation so far.
- Attached screenshots: captured frames from the PM/founder's live screen share. These are helpful
  as visual grounding for the current product surface and workflow context.

<decision>
${decision}
</decision>

<tradeoff>
${tradeoff}
</tradeoff>

<transcript>
${transcript}
</transcript>

The screenshots below are captured frames from what the PM/founder screenshared during the intake.
Use the attached image blocks as context for the current product surface and workflow.

## What To Do

Generate exactly one lo-fi wireframe sketch for the given tradeoff.

Each sketch should:

- be self-contained HTML with inline CSS only.
- use no JavaScript, external assets, external fonts, or remote URLs.
- fit within a 1720px by 1120px canvas.
- The must feel rough and fast, like an Excalidraw-style product wireframe. DO NOT make it look like
  real UI or use any design system. It should feel like a simple sketch.
- The idea must be immediately visible - reduce text, and UI elements, just make the idea apparent.
  LESS IS MORE.
- avoid realistic product styling: no shadows, polished cards, dense tables, pills, dashboards, nav,
  headers, modals, or multi-section layouts, etc.
- ESSENTIAL: Ruthlessly minimize what is in the sketch. The sketch should contain only what is
  necessary to expose the tradeoff. If an element does not change how the PM understands the
  decision, omit it. Make complexity visible through the contrast between the three approaches, not
  by packing more controls into each approach.

The caption should explain the product bet or tradeoff the sketch is testing. Make these captions
snappy, short, to the point, and easy to read quickly.

Return structured output matching the provided JSON schema.
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
            "decision": json.dumps(decision, indent=2),
            "tradeoff": tradeoff,
            "transcript": transcript,
        },
        config=config,
        effort="low",
        json_schema=_DECISION_SKETCH_SCHEMA,
        model="sonnet",
        session_id=session_id,
    )

    post_events(
        config=config,
        events=[
            {
                "type": "slot_updated",
                "slot_id": sketch_slot_id,
                "element": {
                    "type": "html",
                    "html": _wrap_sketch_html(
                        str(result["html"]),
                        str(result["title"]),
                    ),
                },
            },
            {
                "type": "slot_updated",
                "slot_id": caption_slot_id,
                "element": {
                    "type": "text",
                    "variant": "p",
                    "bold": False,
                    "text": f"**{result['title']}**\n\n{result['caption']}",
                },
            },
        ],
    )


@workflow
def generate_decision(
    config: Config,
    params: GenerateDecisionParams,
) -> None:
    """Generate the open decision list and lo-fi sketches for the active decision."""
    mode = params.get("mode") or "initial"
    run_id = params.get("runId") or str(uuid.uuid4())
    project = get_project(config=config)
    transcript = _conversation_transcript(project)
    screenshots = _screenshots(project)
    existing_decisions = project.get("decisions") or []

    plan = call_claude(
        prompt=[
            """\
You are a product designer, working inside the user's actual codebase for this Softlight project.
You are given a discussion of a PM on your team who is working on a design problem.

Your task is to identify the open product/design decisions the PM/founder should work through next.
This is not a UI preference survey. A good decision is a load-bearing open question where different
answers would meaningfully change the product experience, workflow, data shown, user control, edge
cases, or implementation direction.

Do not ask a user if they prefer a specific UI treatment, but rather the context that would make
choosing the UI treatment clear.

## Inputs

You will receive:

- `project_id`: the Softlight project id.
- `mode`: `initial` or `next`.
- `transcript`: the live conversation so far.
- `existing_decisions`: previously generated decisions and their statuses.
- attached screenshots: captured frames from the PM/founder's live screen share.

<project_id>${project_id}</project_id>
<mode>${mode}</mode>
<transcript>
${transcript}
</transcript>

<existing_decisions>
${existing_decisions}
</existing_decisions>

The screenshots below are captured frames from what the PM/founder screenshared during the intake.
Use the attached image blocks as context for the current product surface and workflow.

## What To Do

Use the transcript and codebase to determine what key decisions need to be made next. You MUST find
the source code for the application in question and explore the codebase - a question not grounded
in the current experience is a poor question.

You can think of your task as "what are the open decisions we need to make", but focus on "product"
questions, and not "engineering" questions. Think of these as what a PM would list in a PRD for what
needs to be decided before starting the engineering work.

For `initial` mode:
- Generate 3-6 ordered decisions.
- Each decision should be a direct open question with short explanatory subtext.
- Make the first decision the most useful place to start, but keep every decision `pending`.

For `next` mode:
- Generate exactly one new active decision.
- Treat resolved decisions as closed learning, not as things to ask again.
- Use new transcript/context from the just-finished decision to choose the next best question.
- Do not simply pop the next stale item if the conversation suggests a better next question.

## Decision Quality

Each decision must include:

- `open_question`: one direct question the PM can work through. This should be a snappy direct
  question, quick to read and intuit.
- `subtext`: one short sentence explaining what the user is clarifying and why it matters. This
  should snappy and to the point - something a user can read quickly and understand.
- `sketch_prompt_context`: compact context for the sketch workflow: surface, tradeoff, constraints,
  and what kinds of alternatives should be visualized.
- `tradeoffs`: exactly three distinct product/workflow tradeoffs to visualize as lo-fi sketches.
  Each tradeoff is a short string describing the product bet or alternative the sketch should test —
  not a visual layout variation. Each tradeoff must be meaningfully different from the others
  along the dimensions of user control, data shown, workflow steps, or edge case handling.
- `follow_up_questions`: up to five concise follow-up questions the facilitator can ask the PM
  about this specific decision. These must be about PM-owned context: users, workflow, business
  rules, data, confidence, constraints, edge cases, or risk. Do not ask which sketch the PM prefers,
  and do not ask for visual style feedback.

Never ask for questions that a designer should figure out themselves:
- vague design preferences (e.g. do you prefer this design or that one)
- visual style, color, spacing, exact component, or layout preference questions.
- questions already answered by the conversation.
- generic questions that could apply to any product.
- implementation details unless the PM's decision genuinely depends on a technical constraint.

Return structured output matching the provided JSON schema.
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
        session_id=f"generate_decision_plan:{run_id}",
    )

    raw_active = plan["decisions"][0]
    if mode == "next":
        active_id = _next_decision_id(existing_decisions)
    else:
        active_id = "decision-1"

    follow_up_questions = [
        " ".join(str(question).split())
        for question in (raw_active.get("follow_up_questions") or [])
        if isinstance(question, str) and question.strip()
    ]

    active_decision = {
        "id": active_id,
        "open_question": str(raw_active["open_question"]).strip(),
        "subtext": str(raw_active["subtext"]).strip(),
        "sketch_prompt_context": str(raw_active.get("sketch_prompt_context") or "").strip(),
        "follow_up_questions": follow_up_questions,
        "sketches_ready": False,
        "status": "active",
    }

    decisions: list[dict[str, Any]] = []
    if mode == "next":
        decisions.extend(
            decision for decision in existing_decisions if decision.get("status") == "resolved"
        )
    decisions.append(active_decision)

    tradeoffs = [
        str(tradeoff).strip()
        for tradeoff in raw_active.get("tradeoffs") or []
        if isinstance(tradeoff, str) and str(tradeoff).strip()
    ]
    if not tradeoffs:
        raise ValueError("generate-decision-plan returned no tradeoffs for the active decision")

    base_y = _canvas_bottom(project)
    sketch_count = len(tradeoffs)
    row_width = sketch_count * _SKETCH_WIDTH + (sketch_count - 1) * _SKETCH_GAP

    title_slot_id = str(uuid.uuid4())
    sketch_slot_ids = [str(uuid.uuid4()) for _ in range(sketch_count)]
    caption_slot_ids = [str(uuid.uuid4()) for _ in range(sketch_count)]

    post_events(
        config=config,
        events=[
            {"type": "decision_mode_started"},
            {"type": "decision_list_updated", "decisions": decisions},
            {"type": "revision_created", "revision": {}},
            {
                "type": "slot_created",
                "slot": {
                    "metadata": {"id": title_slot_id},
                    "element": {
                        "type": "text",
                        "variant": "h2",
                        "bold": True,
                        "text": active_decision["open_question"],
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
                            "type": "placeholder",
                            "content_type": "prototype",
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
                        "y": base_y + _TITLE_HEIGHT + _ROW_GAP + _SKETCH_HEIGHT + _ROW_GAP,
                    },
                }
                for index, caption_slot_id in enumerate(caption_slot_ids)
            ],
        ],
    )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=min(_SKETCH_PARALLELISM, sketch_count),
    ) as executor:
        futures = [
            executor.submit(
                _generate_sketch,
                config=config,
                decision=active_decision,
                tradeoff=tradeoff,
                transcript=transcript,
                screenshots=screenshots,
                sketch_slot_id=sketch_slot_ids[index],
                caption_slot_id=caption_slot_ids[index],
                session_id=f"generate_decision_sketch:{active_id}:{run_id}:{index}",
            )
            for index, tradeoff in enumerate(tradeoffs)
        ]
        for future in concurrent.futures.as_completed(futures):
            future.result()

    active_decision["sketches_ready"] = True
    post_events(
        config=config,
        events=[
            {"type": "decision_list_updated", "decisions": decisions},
        ],
    )
