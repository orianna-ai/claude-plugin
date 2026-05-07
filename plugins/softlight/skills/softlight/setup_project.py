from __future__ import annotations

import argparse
import os
import pathlib
import re
import uuid

from scripts.get_project import get_project
from scripts.load_config import load_config
from scripts.post_events import post_events
from scripts.run_app import run_app


def setup_project(
    *,
    project_id: str | None,
) -> None:
    should_resume = project_id is not None

    project_id = str(uuid.uuid4()) if project_id is None else project_id
    print(f"{project_id=}")

    config = load_config(project_id)

    if should_resume:
        post_events(
            config=config,
            events=[
                {
                    "type": "heartbeat",
                },
            ],
        )

        project = get_project(config)

        for revision in project["revisions"]:
            for slot in revision["slots"]:
                if slot["element"]["type"] == "iframe":
                    source_code_dir = slot["element"].get("source_code_dir")
                    if source_code_dir and os.path.isdir(source_code_dir):
                        run_app(
                            config=config,
                            source_code_dir=pathlib.Path(source_code_dir),
                            tunnel_id=slot["element"]["tunnel_id"],
                        )

    redirect_url = f"{config.base_url}/projects/{config.project_id}/intake"
    print(f"{redirect_url=}")


def _parse_project_id(
    value: str,
) -> str:
    match = re.search(r"/projects/([^/?#]+)", value)
    project_id = match.group(1) if match else value
    uuid.UUID(project_id)
    return project_id


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "project_id_or_url",
        nargs="?",
        default=None,
        type=_parse_project_id,
        help="A project id or a project URL containing one.",
    )
    args = parser.parse_args()

    setup_project(
        project_id=args.project_id_or_url,
    )


if __name__ == "__main__":
    main()
