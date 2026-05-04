import json
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config

from workflows.base import workflow


class GenerateMocksParams(TypedDict):
    pass


@workflow
def generate_mocks(
    config: Config,
    params: GenerateMocksParams,
) -> None:
    """
    Use this tool when project.discussion.prd has enough context coverage to identify a concrete
    design decisions that visual mocks could clarify. The criteria for calling this tool is as
    follows:

    Default to generating a first focused set of mocks after the user has answered roughly 2-4
    substantive discovery questions, or sooner, even if there is a no clear Design Approaches
    decision in the PRD that needs to be made. The tool can update the PRD as necessary. If a design
    decision is ready in the PRD and no mocks have been generated yet, use this tool to generate the
    first set of mocks for that decision.

    If the PRD's Design Approaches section names a decision to explore, generate mocks for the next
    most important design decision IF the user has reached the previous design decision related to
    previous mocks added to the canvas.

    If previous mocks were just generated or in progress, only call this tool again when the user
    has reacted to the latest canvas to give feedback on a design decision that needs exploration.
    If they have, then use this tool to generate the next set of mocks for the next design
    decision.

    Lastly, if a user explicitly asks to generate mocks or sketches, use this tool.

    Do not wait for finalized requirements, a complete PRD, a complete Design Approaches section, or
    a fully specified unresolved design decision.
    """
    project = get_project(config)

    conversations = project.get("conversations") or []

    screenshots = []
    seen_screenshot_urls = set()
    for conversation in conversations:
        for screenshot in conversation.get("screenshots") or []:
            image_url = ((screenshot.get("image") or {}).get("url") or "").strip()
            if not image_url or image_url in seen_screenshot_urls:
                continue

            seen_screenshot_urls.add(image_url)
            screenshots.append(
                {
                    "id": f"screenshot_{len(screenshots) + 1:03d}",
                    "url": image_url,
                    "caption": screenshot.get("caption"),
                    "timestamp": screenshot.get("timestamp"),
                    "conversation_room": conversation.get("room"),
                },
            )

    call_claude(
        prompt=[
            """\
Use the `generate-mocks` skill to update the live intake state for Softlight project
${project_id}.

<latest_state>
${latest_state}
</latest_state>

<conversations>
${conversations}
</conversations>

<screenshots>
${screenshots}
</screenshots>
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
            "latest_state": json.dumps(project.get("discussion") or {}, indent=2),
            "conversations": json.dumps(conversations, indent=2),
            "screenshots": json.dumps(screenshots, indent=2),
        },
        config=config,
        effort="low",
        model="opus",
        session_id=f"generate_mocks:{uuid.uuid4()}",
    )
