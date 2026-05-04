import json
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config

from workflows.base import workflow


class ExploreCodebaseParams(TypedDict):
    pass


@workflow
def explore_codebase(
    config: Config,
    params: ExploreCodebaseParams,
) -> None:
    """Do an initial codebase exploration after the user has described the product problem they want
    to solve to get the available product context."""
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

    prompts = [
        {
            "key": prompt.get("key"),
            "status": prompt.get("status"),
            "workflow": prompt.get("workflow"),
        }
        for prompt in project.get("prompts") or []
        if prompt.get("workflow") == "generate_mocks"
        or str(prompt.get("key") or "").startswith("generate_mock_revision:")
    ]

    call_claude(
        prompt=[
            """\
Use the `explore-codebase` skill to update the live intake state for Softlight project
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

<prompts>
${prompts}
</prompts>
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
            "prompts": json.dumps(prompts, indent=2),
        },
        config=config,
        effort="low",
        model="opus",
        session_id=f"explore_codebase:{uuid.uuid4()}",
    )
