import json
import time
import traceback
import uuid
from typing import Any

from scripts.call_claude import call_claude
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow


def _question_queue(output: dict[str, Any]) -> list[dict[str, Any]]:
    questions = output.get("question_queue") or []
    return [
        {
            "question": str(question.get("question", "")).strip(),
            "why_it_matters": str(question.get("why_it_matters", "")).strip(),
            "priority": index + 1,
        }
        for index, question in enumerate(questions[:5])
        if str(question.get("question", "")).strip()
    ]


@workflow
def update_live_intake(
    config: Config,
    params: dict[str, str],
) -> None:
    run_id = params.get("run_id") or uuid.uuid4().hex
    transcript = json.loads(params.get("transcript", "[]"))
    revision = int(params.get("revision", "1"))
    started = time.monotonic()

    post_events(
        config=config,
        events=[
            {
                "type": "intake_claude_run_started",
                "run_id": run_id,
                "reason": params.get("reason", "transcript_update"),
                "transcript_turn_count": len(transcript),
            },
        ],
    )

    try:
        output = call_claude(
            prompt="""\
You are a senior product designer helping a PM/founder on a project that you have no context for.
Your task is to quickly identify the most important questions to ask the PM/founder next.
Optimize for speed - this is a live conversation.

Only ask questions whose answers would materially change the design solution.
Do not repeat anything already asked or answered in the transcript.
Ask for product, user, workflow, goal, constraint, or edge-case context - not UI preferences (e.g.
do not ask whether they prefer cards vs. tables or what visual style they like, etc.).

Return 3-5 concise spoken questions for Gemini to ask.

<transcript>
${transcript}
</transcript>
""",
            params={
                "transcript": json.dumps(transcript, indent=2),
            },
            config=config,
            effort="low",
            model="opus",
            json_schema={
                "type": "object",
                "properties": {
                    "project_understanding": {"type": "string"},
                    "question_queue": {
                        "type": "array",
                        "maxItems": 5,
                        "items": {
                            "type": "object",
                            "properties": {
                                "question": {"type": "string"},
                                "why_it_matters": {"type": "string"},
                                "priority": {"type": "integer"},
                            },
                            "required": ["question", "why_it_matters", "priority"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["project_understanding", "question_queue"],
                "additionalProperties": False,
            },
            session_id=f"live_intake:{run_id}",
        )
        question_queue = _question_queue(output)
        project_understanding = str(output.get("project_understanding", "")).strip()
        duration_ms = int((time.monotonic() - started) * 1000)

        post_events(
            config=config,
            events=[
                {
                    "type": "intake_claude_run_completed",
                    "run_id": run_id,
                    "duration_ms": duration_ms,
                    "question_count": len(question_queue),
                    "questions": [question["question"] for question in question_queue],
                    "project_understanding": project_understanding[:500],
                },
                {
                    "type": "intake_state_updated",
                    "state": {
                        "revision": revision,
                        "project_understanding": project_understanding,
                        "question_queue": question_queue,
                    },
                },
            ],
        )
    except Exception:
        post_events(
            config=config,
            events=[
                {
                    "type": "intake_claude_run_failed",
                    "run_id": run_id,
                    "duration_ms": int((time.monotonic() - started) * 1000),
                    "error": traceback.format_exc()[:4000],
                },
            ],
        )
        raise
