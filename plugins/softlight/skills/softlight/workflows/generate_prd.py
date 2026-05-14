import json
import uuid
from typing import Any, TypedDict

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


def generate_prd_spec(
    *,
    config: Config,
    conversations: list[dict[str, Any]],
    session_id: str,
) -> str:
    result = call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-prd` skill.

Return structured output matching the provided JSON schema.

<conversations>${conversations}</conversations>
""",
        ],
        params={
            "conversations": json.dumps(conversations, indent=2),
        },
        json_schema=_SPEC_SCHEMA,
        model="opus",
        effort="xhigh",
        session_id=session_id,
    )

    spec = result["spec"].strip()
    if not spec:
        raise ValueError("generate-prd returned an empty spec")

    return spec


@workflow()
def generate_prd(
    config: Config,
    params: GeneratePrdParams,
) -> None:
    """Generate or update the project-level PRD/design brief."""
    run_id = str(uuid.uuid4())
    project = get_project(config)

    spec = generate_prd_spec(
        config=config,
        conversations=project.get("conversations", []),
        session_id=f"generate_prd:{run_id}",
    )

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "spec": spec,
            },
        ],
    )
