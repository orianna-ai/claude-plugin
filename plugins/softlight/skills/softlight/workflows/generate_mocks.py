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
    Generate one focused set of sketches from the current intake transcript and screenshots.
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
Use the `generate-mocks` skill to generate sketches for Softlight project ${project_id}.

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
            "conversations": json.dumps(conversations, indent=2),
            "screenshots": json.dumps(screenshots, indent=2),
        },
        config=config,
        effort="medium",
        model="sonnet",
        session_id=f"generate_mocks:{uuid.uuid4()}",
    )
