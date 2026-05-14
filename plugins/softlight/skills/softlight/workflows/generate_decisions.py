import concurrent.futures
import json
import uuid
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow

_SKETCH_AUTHOR_WIDTH = 760
_SKETCH_AUTHOR_HEIGHT = 520
_SKETCH_PARALLELISM = 4


class GenerateDecisionsParams(TypedDict, total=False):
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


def _next_decision_id(existing_decisions: list[dict[str, Any]]) -> str:
    used = {str(decision.get("id") or "") for decision in existing_decisions}
    for index in range(1, len(used) + 8):
        candidate = f"decision-{index}"
        if candidate not in used:
            return candidate
    return f"decision-{uuid.uuid4().hex[:8]}"


def _decision_from_raw(
    *,
    raw_decision: dict[str, Any],
    decision_id: str,
    status: str,
) -> dict[str, Any]:
    follow_up_questions = [
        " ".join(str(question).split())
        for question in (raw_decision.get("follow_up_questions") or [])
        if isinstance(question, str) and question.strip()
    ]
    tradeoffs = [
        " ".join(str(tradeoff).split())
        for tradeoff in (raw_decision.get("tradeoffs") or [])
        if isinstance(tradeoff, str) and str(tradeoff).strip()
    ]
    return {
        "id": decision_id,
        "open_question": str(raw_decision["open_question"]).strip(),
        "subtext": str(raw_decision["subtext"]).strip(),
        "sketch_prompt_context": str(
            raw_decision.get("sketch_prompt_context") or "",
        ).strip(),
        "follow_up_questions": follow_up_questions,
        "sketches": [],
        "sketches_ready": False,
        "tradeoffs": tradeoffs,
        "status": status,
    }


def _generate_sketch(
    *,
    config: Config,
    decision: dict[str, Any],
    tradeoff: str,
    transcript: str,
    screenshots: list[dict[str, Any]],
    session_id: str,
) -> dict[str, Any]:
    result = call_claude(
        prompt=[
            """\
You are a senior product designer using a quick sketch to help a PM/founder clarify one active
decision. The sketch is a conversation probe, not a polished design.

## Inputs

You will receive:

- `decision`: the active decision, including `open_question`, `subtext`, and
  `sketch_prompt_context`.
- `tradeoff`: a short description of the specific wireframe to sketch in this run.
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

Generate exactly one lo-fi wireframe sketch for the given tradeoff. A wireframe is a
single page or screen of the product.

Each sketch should:

- Represent a single page, component, or screen of the product. The main view that communicates the
idea.
- Be self-contained HTML with inline CSS only.
- Use no JavaScript, external assets, external fonts, or remote URLs.
- Fit in a ${sketch_author_width}px by ${sketch_author_height}px canvas.
- The must feel rough and fast, like an Excalidraw-style product wireframe. DO NOT make it look like
  real UI or use any design system. It should feel like a really simple sketch.
- The idea must be immediately visible - reduce text, and UI elements, just make the idea apparent.
  LESS IS MORE.
- Avoid realistic product styling: no shadows, polished cards, dense tables, pills, dashboards, nav,
  headers, modals, or multi-section layouts, etc.
- ESSENTIAL: Ruthlessly minimize what is in the sketch. The sketch should contain only what is
  necessary to expose the tradeoff. If an element does not change how the PM understands the
  decision, omit it.

Return structured output matching the provided JSON schema. Any caption you output as part of that
output schema should be snappy, short, to the point, and easy to read quickly.
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
            "sketch_author_height": _SKETCH_AUTHOR_HEIGHT,
            "sketch_author_width": _SKETCH_AUTHOR_WIDTH,
            "tradeoff": tradeoff,
            "transcript": transcript,
        },
        config=config,
        effort="low",
        json_schema=_DECISION_SKETCH_SCHEMA,
        model="sonnet",
        session_id=session_id,
        tools=[],
    )

    return {
        "tradeoff": tradeoff,
        "title": str(result["title"]).strip(),
        "html": str(result["html"]),
        "caption": str(result["caption"]).strip(),
    }


def _generate_sketches_for_decision(
    *,
    config: Config,
    decision: dict[str, Any],
    transcript: str,
    screenshots: list[dict[str, Any]],
    run_id: str,
) -> list[dict[str, Any]]:
    tradeoffs = [
        tradeoff
        for tradeoff in decision.get("tradeoffs") or []
        if str(tradeoff).strip()
    ]
    if not tradeoffs:
        raise ValueError(
            f"decision {decision.get('id')!r} has no tradeoffs to sketch",
        )

    sketches: list[dict[str, Any] | None] = [None] * len(tradeoffs)
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=min(_SKETCH_PARALLELISM, len(tradeoffs)),
    ) as executor:
        futures = {
            executor.submit(
                _generate_sketch,
                config=config,
                decision=decision,
                tradeoff=tradeoff,
                transcript=transcript,
                screenshots=screenshots,
                session_id=(
                    f"generate_decision_sketch:{decision['id']}:{run_id}:{index}"
                ),
            ): index
            for index, tradeoff in enumerate(tradeoffs)
        }
        for future in concurrent.futures.as_completed(futures):
            sketches[futures[future]] = future.result()

    return [sketch for sketch in sketches if sketch is not None]


def _generate_decision_plan(
    *,
    config: Config,
    mode: str,
    transcript: str,
    screenshots: list[dict[str, Any]],
    existing_decisions: list[dict[str, Any]],
    run_id: str,
) -> list[dict[str, Any]]:
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
- Generate exactly one new pending decision.
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
- `follow_up_questions`: up to 2-3 concise follow-up questions the facilitator can ask the PM
  about this specific decision. These must be about PM-owned context: users, workflow, business
  rules, data, confidence, constraints, edge cases, or risk. Do not ask which sketch the PM prefers,
  and do not ask for visual style feedback.

## Follow-Up Question Quality

The facilitator will ask these after sketches are available on the canvas, so frame each question
through the alternatives the sketches are meant to explore. A strong follow-up question says what
the sketches are testing, asks for the PM-owned truth that decides between those directions, and
makes clear why the answer changes the product direction.

Use this shape:
"The sketches outline [product/workflow alternatives]. For [users/workflow/business/data/risk],
is it more true that [A] or [B]? That tells us whether to [direction] or [direction]."

Good examples:
- "The sketches outline a guided setup versus a faster self-serve path. For new admins, is it more
  important that they finish quickly or that they understand each permission before continuing?
  That tells us whether to compress the flow or add checkpoints."
- "The sketches test showing exceptions inline versus routing them to a review queue. When an
  exception appears, does the operator usually need to keep working in context or hand it off? That
  determines whether the UI should prioritize local resolution or triage."
- "The sketches compare surfacing confidence early versus waiting until after the user commits.
  Is low confidence something users should react to immediately, or only when it blocks action?
  That tells us whether uncertainty belongs in the main path or the final review."

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
        disallowed_tools=["mcp__softlight__create_exploration"],
        effort="low",
        json_schema=_DECISION_PLAN_SCHEMA,
        model="opus",
        session_id=f"generate_decision_plan:{run_id}",
    )

    if mode == "next":
        raw_decision = plan["decisions"][0]
        new_decision = _decision_from_raw(
            raw_decision=raw_decision,
            decision_id=_next_decision_id(existing_decisions),
            status="pending",
        )
        return [*existing_decisions, new_decision]

    return [
        _decision_from_raw(
            raw_decision=raw_decision,
            decision_id=f"decision-{index}",
            status="pending",
        )
        for index, raw_decision in enumerate(plan["decisions"], start=1)
    ]


@workflow()
def generate_decisions(
    config: Config,
    params: GenerateDecisionsParams,
) -> None:
    """Generate the open decision list and the sketches for each decision."""
    mode = params.get("mode") or "initial"
    run_id = params.get("runId") or str(uuid.uuid4())
    project = get_project(config=config)
    transcript = _conversation_transcript(project)
    screenshots = _screenshots(project)
    existing_decisions = list(project.get("decisions") or [])

    if mode == "next" or not existing_decisions:
        decisions = _generate_decision_plan(
            config=config,
            mode=mode,
            transcript=transcript,
            screenshots=screenshots,
            existing_decisions=existing_decisions,
            run_id=run_id,
        )
        post_events(
            config=config,
            events=[
                {
                    "type": "decision_updated",
                    "decision_mode_started": True,
                    "decisions": decisions,
                },
            ],
        )
    else:
        decisions = existing_decisions

    for decision in decisions:
        if decision.get("sketches_ready") or not decision.get("tradeoffs"):
            continue

        sketches = _generate_sketches_for_decision(
            config=config,
            decision=decision,
            transcript=transcript,
            screenshots=screenshots,
            run_id=run_id,
        )
        decision["sketches"] = sketches
        decision["sketches_ready"] = True
        post_events(
            config=config,
            events=[
                {
                    "type": "decision_updated",
                    "decision_id": decision["id"],
                    "sketches": sketches,
                    "sketches_ready": True,
                },
            ],
        )
