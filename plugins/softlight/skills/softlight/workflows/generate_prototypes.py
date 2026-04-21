from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow


@workflow
def generate_prototypes(
    config: Config,
    params: dict[str, str],
) -> None:
    run_designer_codegen_output = call_claude(
        prompt="""\
Use the `run-designer-codegen` skill to generate explorations in the project.

Run the skill in ${mode} mode.
""",
        params={
            "mode": params.get("mode", "initial"),
        },
        config=config,
        effort="xhigh",
        json_schema={
            "type": "object",
            "properties": {
                "handoff_file_path": {
                    "type": "string",
                },
            },
            "required": ["handoff_file_path"],
            "additionalProperties": False,
        },
        model="opus",
        session_id="run_designer_codegen",
    )

    call_claude(
        prompt="""\
Invoke the `present-and-generate` skill.

Use the handoff file at ${handoff_file_path}.
""",
        params={
            "handoff_file_path": run_designer_codegen_output["handoff_file_path"],
        },
        config=config,
        effort="max",
        model="opus",
        session_id="present_and_generate",
    )
