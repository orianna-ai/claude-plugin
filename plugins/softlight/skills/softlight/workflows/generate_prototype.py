import json
import pathlib
import uuid
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.call_mcp import call_mcp
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow


class GeneratePrototypeParams(TypedDict):
    pass


def generate_prototype_app(
    *,
    config: Config,
    conversations: list[dict[str, Any]],
    prototype_dir: pathlib.Path,
    session_id: str,
    spec: str,
) -> None:
    design_context = (
        f"<spec>{spec}</spec>"
        if spec
        else (f"<conversations>{json.dumps(conversations, indent=2)}</conversations>")
    )

    call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-prototype` skill.

${design_context}
<prototype_dir>${prototype_dir}</prototype_dir>
""",
        ],
        params={
            "prototype_dir": str(prototype_dir),
            "design_context": design_context,
        },
        model="opus",
        effort="low",
        session_id=session_id,
    )


@workflow
def generate_prototype(
    config: Config,
    params: GeneratePrototypeParams,
) -> None:
    """Create a baseline clone of the user's app as a starting point for design exploration."""
    prototype_dir = create_app()

    project = get_project(config)
    spec = (project.get("spec") or "").strip()
    exploration = call_mcp(
        config=config,
        tool="create_exploration",
        arguments={
            "count": 1,
            "project_id": config.project_id,
            "title": "High-fidelity prototype",
        },
        timeout=30,
    )
    slot_id = exploration["slot_ids"][0]
    cleanup_slot_ids = [
        exploration["title_slot_id"],
        *exploration["caption_slot_ids"],
    ]
    post_events(
        config=config,
        events=[
            {
                "type": "slot_deleted",
                "slot_id": cleanup_slot_id,
            }
            for cleanup_slot_id in cleanup_slot_ids
        ],
    )

    try:
        generate_prototype_app(
            config=config,
            conversations=project.get("conversations", []),
            prototype_dir=prototype_dir,
            session_id="generate_prototype",
            spec=spec,
        )

        tunnel_id = str(uuid.uuid4())

        run_app(
            config=config,
            source_code_dir=prototype_dir,
            tunnel_id=tunnel_id,
        )

        post_events(
            config=config,
            events=[
                {
                    "type": "slot_updated",
                    "element": {
                        "type": "iframe",
                        "source_code_dir": str(prototype_dir),
                        "screenshots": [],
                        "spec": spec,
                        "tunnel_id": tunnel_id,
                    },
                    "slot_id": slot_id,
                },
            ],
        )
    except Exception as exception:
        post_events(
            config=config,
            events=[
                {
                    "type": "slot_updated",
                    "element": {
                        "type": "error",
                        "message": str(exception),
                    },
                    "slot_id": slot_id,
                },
            ],
        )

        raise
