import sys
import uuid

from scripts.load_config import load_config
from scripts.post_events import post_events


def setup_project(
    *,
    problem_statement: str,
) -> None:
    project_id = str(uuid.uuid4())
    print(f"{project_id=}")

    config = load_config(project_id)

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "problem": {
                    "text": problem_statement,
                    "baseline": {
                        "type": "iframe",
                        "content_script": None,
                        "tunnel_id": "",
                    },
                    "attachments": [],
                },
            },
        ],
    )

    project_url = f"{config.base_url}/projects/{config.project_id}"
    print(f"{project_url=}")


def main() -> None:
    setup_project(
        problem_statement=sys.stdin.read(),
    )


if __name__ == "__main__":
    main()
