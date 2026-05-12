from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING, Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.post_events import post_events

from workflows.base import workflow

if TYPE_CHECKING:
    from scripts.load_config import Config


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


def transcript_conversations(
    conversations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        {key: value for key, value in conversation.items() if key != "screenshots"}
        for conversation in conversations
    ]


def generate_prd_spec(
    *,
    approach: str | None = None,
    config: Config,
    conversations: list[dict[str, Any]],
    session_id: str,
) -> str:
    approach_section = (
        ""
        if not approach
        else f"""\
Use this approach/theme as the direction for this PRD. Treat it as the theme to follow when
determining the design work:

<approach>{approach}</approach>

"""
    )
    result = call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-prd` skill.

Return structured output matching the provided JSON schema.

${approach_section}\
<conversations>${conversations}</conversations>
""",
        ],
        params={
            "approach_section": approach_section,
            "conversations": json.dumps(
                transcript_conversations(conversations),
                indent=2,
            ),
        },
        json_schema=_SPEC_SCHEMA,
        fork_session=False,
        model="opus",
        effort="xhigh",
        session_id=session_id,
    )

    spec = result["spec"].strip()
    if not spec:
        raise ValueError("generate-prd returned an empty spec")

    return spec


@workflow
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
