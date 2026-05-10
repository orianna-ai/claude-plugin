import json
import pathlib
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow


class EditPrototypeParams(TypedDict):
    pass


@workflow
def edit_prototype(
    config: Config,
    params: EditPrototypeParams,
) -> None:
    """Edit an existing prototype."""
    project = get_project(config)

    call_claude(
        config=config,
        prompt=[
            """\
Call the `edit-prototype` skill.

<conversations>${conversations}</conversations>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
        ],
        params={
            "prototype_dir": project["prototype_dir"],
            "conversations": json.dumps(project.get("conversations", []), indent=2),
        },
        model="opus",
        effort="low",
        session_id="generate_prototype",
    )

    tunnel_id = str(uuid.uuid4())

    run_app(
        config=config,
        source_code_dir=pathlib.Path(project["prototype_dir"]),
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
                        "source_code_dir": project["prototype_dir"],
                        "screenshots": [],
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
