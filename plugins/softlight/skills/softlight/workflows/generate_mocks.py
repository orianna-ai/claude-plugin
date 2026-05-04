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
    If the PRD has some context coverage, and clear design decisions in the Design Approaches'
    section, use this tool to generate mocks for the next most imporatnt design decision that needs
    to be made. While we need some context to understand the core problem, we don't need a complete
    PRD to generate mocks. We want to show the user the next most important design decision quickly
    visually, so they can give feedback on it.

    Default to generating a first focused set of mocks after the user has answered roughly 2-4
    substantive discovery questions, or sooner, if there is a clear Design Approaches decision that
    needs to be made.

    After mocks are generated, call this tool again whenever the user reacts to the latest canvas to
    give feedback on a design decisions that is needed. Move to the next design decision via this
    tool as soon as you can.

    Do not wait for finalized requirements, a complete Design Approaches section, or a fully
    specified unresolved design decision. It is enough that there is a concrete product surface,
    workflow, or interaction choice that sketches could clarify.
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
