import json
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config

from workflows.base import workflow


class LiveIntakeManagerParams(TypedDict):
    pass


@workflow
def live_intake_manager(
    config: Config,
    params: LiveIntakeManagerParams,
) -> None:
    """Update the live-intake topics and PRD from the conversation so far, and generate sketch
    mocks when there is enough context to make them useful.
    """
    project = get_project(config)

    conversations = project.get("conversations") or []

    call_claude(
        prompt=[
            """\
Use the `live-intake-manager` skill to update the live intake state for Softlight project
${project_id}.

<latest_state>
${latest_state}
</latest_state>

<conversations>
${conversations}
</conversations>
""",
            *(
                {
                    "type": "image",
                    "source": {"type": "url", "url": screenshot["image"]["url"]},
                }
                for conversation in conversations
                for screenshot in conversation.get("screenshots") or []
            ),
        ],
        params={
            "project_id": config.project_id,
            "latest_state": json.dumps(project.get("discussion") or {}, indent=2),
            "conversations": json.dumps(conversations, indent=2),
        },
        config=config,
        effort="low",
        model="opus",
        session_id="live_intake_manager",
    )
