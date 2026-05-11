import json
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow


class GeneratePrdParams(TypedDict):
    pass


_SPEC_SCHEMA = {
    "type": "object",
    "properties": {
        "spec": {
            "type": "string",
            "description": "Markdown PRD/design brief for prototype generation.",
        },
    },
    "required": ["spec"],
    "additionalProperties": False,
}


@workflow
def generate_prd(
    config: Config,
    params: GeneratePrdParams,
) -> None:
    """Generate or update the project-level PRD/design brief."""
    project = get_project(config)

    result = call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-prd` skill.

Return structured output matching the provided JSON schema.

<previous_spec>${previous_spec}</previous_spec>
<conversations>${conversations}</conversations>
""",
        ],
        params={
            "previous_spec": project.get("spec") or "",
            "conversations": json.dumps(project.get("conversations", []), indent=2),
        },
        json_schema=_SPEC_SCHEMA,
        model="opus",
        effort="xhigh",
        session_id="generate_prd",
    )

    spec = result["spec"].strip()
    if not spec:
        raise ValueError("generate-prd returned an empty spec")

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "spec": spec,
            },
        ],
    )
