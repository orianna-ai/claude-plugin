import json
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow


class GeneratePrototypesParams(TypedDict):
    pass


@workflow
def generate_prototype(
    config: Config,
    params: GeneratePrototypesParams,
) -> None:
    """Create a baseline clone of the user's app as a starting point for design exploration."""
    prototype_dir = create_app()

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "prototype_dir": str(prototype_dir),
            },
        ],
    )

    project = get_project(config)
    spec = (project.get("spec") or "").strip()
    design_context = (
        f"<spec>{spec}</spec>"
        if spec
        else (
            f"<conversations>"
            f"{json.dumps(project.get('conversations', []), indent=2)}"
            f"</conversations>"
        )
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
        session_id="generate_prototype",
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
                "type": "slot_created",
                "slot": {
                    "element": {
                        "type": "iframe",
                        "source_code_dir": str(prototype_dir),
                        "tunnel_id": tunnel_id,
                    },
                    "x": 0,
                    "y": 0,
                    "width": 1720,
                    "height": 1120,
                },
            },
        ],
    )
