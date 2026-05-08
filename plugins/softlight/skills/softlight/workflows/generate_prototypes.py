import pathlib
import time
import uuid
from typing import TypedDict

from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow


class GeneratePrototypesParams(TypedDict):
    pass


@workflow
def generate_prototypes(
    config: Config,
    params: GeneratePrototypesParams,
) -> None:
    """Create a baseline clone of the user's app as a starting point for design exploration."""
    project = get_project(
        config=config,
    )

    slot_id = str(uuid.uuid4())

    post_events(
        config=config,
        events=[
            {
                "type": "slot_created",
                "slot": {
                    "element": {
                        "type": "placeholder",
                        "content_type": "prototype",
                    },
                    "metadata": {
                        "id": slot_id,
                    },
                    "x": 0,
                    "y": 0,
                    "width": 0,
                    "height": 0,
                },
            },
        ],
    )

    while True:
        project = get_project(
            config=config,
        )

        # TODO: maybe if there's a prototype in progress we should wait for it? maybe we should
        # trigger another one? we can figure it out when we get to that.
        if prototypes := project.get("prototypes"):
            tunnel_id = str(uuid.uuid4())

            source_code_dir = prototypes[-1]["source_code_dir"]

            run_app(
                config=config,
                source_code_dir=pathlib.Path(source_code_dir),
                tunnel_id=tunnel_id,
            )

            post_events(
                config=config,
                events=[
                    {
                        "type": "slot_updated",
                        "element": {
                            "type": "iframe",
                            "source_code_dir": source_code_dir,
                            "screenshots": [],
                            "tunnel_id": tunnel_id,
                        },
                        "slot_id": slot_id,
                    },
                ],
            )

            return

        time.sleep(5)
