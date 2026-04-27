import concurrent.futures
import time

from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow

# Stagger between subprocess spawns. Each `claude -p` launches its own
# `npx mcp-remote` children; spawning all of them in the same instant has
# starved one of the slower handshakes past Claude Code's deferred-MCP
# timeout. 2s of spacing lets each child finish its tools/list handshake
# before the next one starts.
_SPAWN_STAGGER_S = 2.0


@workflow
def generate_prototypes(
    config: Config,
    params: dict[str, str],
) -> None:
    feedback = params.get("feedback", "").strip()
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
        prompt="""\
${feedback_section}\
Use the `run-designer-codegen` skill to generate explorations in the project.

<mode>${mode}</mode>
""",
        params={
            "feedback_section": feedback_section,
            "mode": params.get("mode", "revision" if feedback else "initial"),
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
                    "explorations_created": handoff["present_canvas"][
                        "explorations_created"
                    ],
                },
                config=config,
                effort="low",
                model="opus",
                session_id="present_canvas",
            ),
        )

        for prototype in handoff["prototypes"]:
            time.sleep(_SPAWN_STAGGER_S)
            futures.append(
                executor.submit(
                    call_claude,
                    prompt="""\
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
