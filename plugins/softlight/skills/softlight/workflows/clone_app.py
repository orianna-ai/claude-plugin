import json
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.load_config import Config

from workflows.base import workflow


class CloneAppParams(TypedDict, total=False):
    pass


def _conversation_screenshots(
    project: dict[str, Any],
) -> list[dict[str, Any]]:
    screenshots = []
    seen_screenshot_urls = set()
    for conversation in project.get("conversations") or []:
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

    return screenshots


@workflow
def clone_app(
    config: Config,
    params: CloneAppParams,
) -> None:
    """Create a baseline clone of the user's app as a starting point for design exploration."""
    project = get_project(config)
    if (((project.get("baseline") or {}).get("source_code_dir")) or "").strip():
        return

    screenshots = _conversation_screenshots(project)

    cloned_code_dir = create_app()

    call_claude(
        config=config,
        prompt=[
            """\
Use the `clone-app` skill to write a baseline clone into the clone directory so it visually
matches the source app as it exists right now.

This is only a clone task. Use the project context, transcript, and screenshots to identify the
application, current app surface, and screen/state to reproduce. Do not implement the requested
feature, create design explorations, or modify the source app. After the clone builds, follow the
`clone-app` skill's final steps to preview it, create the tunnel, capture baseline screenshots, and
register the baseline on the project.

<project_context>
${project_context}
</project_context>

<screenshots>
${screenshots}
</screenshots>

<project_id>
${project_id}
</project_id>

<cloned_code_dir>
${cloned_code_dir}
</cloned_code_dir>
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
            "project_context": json.dumps(project, indent=2),
            "screenshots": json.dumps(screenshots, indent=2),
            "project_id": config.project_id,
            "cloned_code_dir": str(cloned_code_dir),
        },
        model="sonnet",
        effort="medium",
        session_id="clone_app",
    )
