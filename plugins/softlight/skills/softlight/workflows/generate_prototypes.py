import concurrent.futures
import json
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config

from workflows.base import workflow


def _is_filtered_canvas_slot(
    slot: dict[str, Any],
) -> bool:
    element = slot.get("element") or {}
    element_type = element.get("type")

    if element_type == "image":
        return True

    return element_type == "placeholder" and element.get("content_type") == "mock"


def _filtered_canvas_context(
    project: dict[str, Any],
) -> dict[str, Any]:
    revisions = []
    for revision in project.get("revisions") or []:
        slots = [slot for slot in revision.get("slots") or [] if not _is_filtered_canvas_slot(slot)]
        revisions.append({**revision, "slots": slots})

    return {
        "metadata": project.get("metadata"),
        "title": project.get("title"),
        "baseline": project.get("baseline"),
        "revisions": revisions,
        "pull_requests": project.get("pull_requests") or [],
    }


class GeneratePrototypesParams(TypedDict):
    mode: str
    brief: str
    feedback: str


@workflow
def generate_prototypes(
    config: Config,
    params: GeneratePrototypesParams,
) -> None:
    """Generate design prototype variants in the project from a brief or PM feedback."""
    canvas_context = _filtered_canvas_context(get_project(config))
    feedback = params["feedback"].strip()
    feedback_section = (
        ""
        if not feedback
        else f"""\
The PM reviewed the canvas and left feedback. Use the `run-designer-codegen` skill to create new
revisions that address their feedback. The app clone and project have already been created — you do
not need to do that again. Do not stop until you have generated every prototype in every
exploration.

<feedback>
{feedback}
</feedback>

"""
    )

    handoff = call_claude(
        prompt=[
            """\
${feedback_section}\
Use the `run-designer-codegen` skill to generate explorations in the project.

<mode>${mode}</mode>
<transcript>${transcript}</transcript>
<canvas_context>${canvas_context}</canvas_context>
""",
        ],
        params={
            "feedback_section": feedback_section,
            "mode": params["mode"],
            "transcript": params["brief"],
            "canvas_context": json.dumps(canvas_context, indent=2),
        },
        config=config,
        effort="low",
        json_schema={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "baseline_dir": {"type": "string"},
                "prototypes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "slot_id": {"type": "string"},
                            "caption_slot_id": {"type": "string"},
                            "spec": {"type": "string"},
                            "images": {"type": "array", "items": {"type": "string"}},
                            "context": {"type": "string"},
                            "prototype_dir": {"type": "string"},
                        },
                        "required": ["slot_id", "spec", "images", "context"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["project_id", "baseline_dir", "prototypes"],
            "additionalProperties": False,
        },
        model="opus",
        session_id="run_designer_codegen",
    )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=len(handoff["prototypes"]),
    ) as executor:
        futures = []

        for prototype in handoff["prototypes"]:
            futures.append(
                executor.submit(
                    call_claude,
                    prompt=[
                        """\
Dispatch the `generate-prototype` skill with these inputs.

<project_id>${project_id}</project_id>
<slot_id>${slot_id}</slot_id>
<caption_slot_id>${caption_slot_id}</caption_slot_id>
<baseline_dir>${baseline_dir}</baseline_dir>
<spec>${spec}</spec>
<images>${images}</images>
<context>${context}</context>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
                    ],
                    params={
                        "project_id": handoff["project_id"],
                        "slot_id": prototype["slot_id"],
                        "caption_slot_id": prototype.get("caption_slot_id", ""),
                        "baseline_dir": handoff["baseline_dir"],
                        "spec": prototype["spec"],
                        "images": "\n".join(prototype["images"]),
                        "context": prototype["context"],
                        "prototype_dir": prototype.get("prototype_dir", ""),
                    },
                    config=config,
                    effort="xhigh",
                    model="opus",
                    session_id=f"generate_prototype:{prototype['slot_id']}",
                ),
            )

        errors: list[BaseException] = []

        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except BaseException as exception:
                errors.append(exception)

        if errors:
            raise RuntimeError(
                "\n".join(
                    [
                        f"{len(errors)} of {len(futures)} agents failed:",
                        *(f"  {e!r}" for e in errors),
                    ],
                ),
            )
