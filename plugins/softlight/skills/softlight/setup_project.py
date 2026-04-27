import argparse
import uuid

from scripts.load_config import load_config
from scripts.post_events import post_events


def setup_project(
    *,
    title: str,
    project_id: str | None = None,
) -> None:
    if project_id is None:
        project_id = str(uuid.uuid4())
    print(f"{project_id=}")

    config = load_config(project_id)

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "title": title,
            },
            {
                "type": "prompt_created",
                "prompt": {
                    "workflow": "generate_prototypes",
                    "key": "generate_prototypes",
                },
            },
        ],
    )

    project_url = f"{config.base_url}/projects/{config.project_id}"
    print(f"{project_url=}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--project-id", default=None)
    args = parser.parse_args()

    setup_project(
        title=args.title,
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
