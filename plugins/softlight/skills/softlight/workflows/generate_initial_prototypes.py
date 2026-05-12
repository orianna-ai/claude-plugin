import uuid
from typing import Any, TypedDict

from scripts.call_mcp import call_mcp
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow
from workflows.generate_initial_prototype import generate_initial_prototype_app
from workflows.generate_prd import generate_prd_spec


class GenerateInitialPrototypesParams(TypedDict, total=False):
    brief: str
    runId: str


def _conversations_for_prd(
    *,
    brief: str,
    conversations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if any(conversation.get("messages") for conversation in conversations):
        return conversations
    if not brief:
        return conversations
    return [
        {
            "room": "exported-transcript",
            "messages": [
                {
                    "role": "user",
                    "text": brief,
                    "timestamp": 0.0,
                },
            ],
            "screenshots": [],
        },
    ]


@workflow
def generate_initial_prototypes(
    config: Config,
    params: GenerateInitialPrototypesParams,
) -> None:
    """Generate one PRD-backed initial prototype in the project."""
    run_id = params.get("runId") or str(uuid.uuid4())
    brief = params.get("brief", "").strip()

    project = get_project(config=config)
    conversations = _conversations_for_prd(
        brief=brief,
        conversations=project.get("conversations", []),
    )
    spec = generate_prd_spec(
        config=config,
        conversations=conversations,
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

    prototype_dir = create_app()

    exploration = call_mcp(
        config=config,
        tool="create_exploration",
        arguments={
            "count": 1,
            "project_id": config.project_id,
            "title": "Initial prototype",
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
        project = get_project(config=config)
        generate_initial_prototype_app(
            config=config,
            conversations=project.get("conversations", []),
            prototype_dir=prototype_dir,
            session_id=f"generate_initial_prototype:{run_id}",
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
