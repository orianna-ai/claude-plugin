import concurrent.futures

from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow


@workflow
def generate_prototypes(
    config: Config,
    params: dict[str, str],
) -> None:
    handoff = call_claude(
        prompt="""\
Use the `run-designer-codegen` skill to generate explorations in the project.

<mode>${mode}</mode>
""",
        params={
            "mode": params.get("mode", "initial"),
        },
        config=config,
        effort="low",
        json_schema={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "baseline_dir": {"type": "string"},
                "present_canvas": {
                    "type": "object",
                    "properties": {
                        "thinking": {"type": "string"},
                        "explorations_created": {"type": "string"},
                    },
                    "required": ["thinking", "explorations_created"],
                    "additionalProperties": False,
                },
                "prototypes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "slot_id": {"type": "string"},
                            "caption_slot_id": {"type": "string"},
                            "spec_url": {"type": "string"},
                            "images": {"type": "array", "items": {"type": "string"}},
                            "context": {"type": "string"},
                            "prototype_dir": {"type": "string"},
                        },
                        "required": ["slot_id", "spec_url", "images", "context"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["project_id", "baseline_dir", "present_canvas", "prototypes"],
            "additionalProperties": False,
        },
        model="opus",
        session_id="run_designer_codegen",
    )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=len(handoff["prototypes"]) + 1,
    ) as executor:
        futures = []

        futures.append(
            executor.submit(
                call_claude,
                prompt="""\
Dispatch the `present-canvas` skill with these inputs.

<project_id>${project_id}</project_id>
<mode>${mode}</mode>
<thinking>${thinking}</thinking>
<explorations_created>${explorations_created}</explorations_created>
""",
                params={
                    "project_id": handoff["project_id"],
                    "mode": params.get("mode", "initial"),
                    "thinking": handoff["present_canvas"]["thinking"],
                    "explorations_created": handoff["present_canvas"]["explorations_created"],
                },
                config=config,
                effort="low",
                model="opus",
                session_id="present_canvas",
            ),
        )

        for prototype in handoff["prototypes"]:
            futures.append(
                executor.submit(
                    call_claude,
                    prompt="""\
Dispatch the `generate-prototype` skill with these inputs.

<project_id>${project_id}</project_id>
<slot_id>${slot_id}</slot_id>
<caption_slot_id>${caption_slot_id}</caption_slot_id>
<baseline_dir>${baseline_dir}</baseline_dir>
<spec_url>${spec_url}</spec_url>
<images>${images}</images>
<context>${context}</context>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
                    params={
                        "project_id": handoff["project_id"],
                        "slot_id": prototype["slot_id"],
                        "caption_slot_id": prototype.get("caption_slot_id", ""),
                        "baseline_dir": handoff["baseline_dir"],
                        "spec_url": prototype["spec_url"],
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
