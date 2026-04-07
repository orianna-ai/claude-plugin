import json
import time
import urllib.request

from scripts.load_config import load_config

from workflows.generate_revision import generate_revision


def _run_workflow(
    name: str,
) -> None:
    match name:
        case "generate_revision":
            generate_revision()
        case _:
            raise ValueError(f"unknown workflow: {name!r}")


def dispatch_workflows() -> None:
    config = load_config()
    assert config.project_id is not None
    assert config.base_url is not None

    cursor = 0

    while True:
        with urllib.request.urlopen(
            urllib.request.Request(
                f"{config.base_url}/api/projects/{config.project_id}/events",
            ),
        ) as response:
            events = json.loads(response.read())

        for event in events[cursor:]:
            if event.get("type") == "workflow_requested":
                _run_workflow(event["name"])

        cursor = len(events)

        time.sleep(10)


def main() -> None:
    dispatch_workflows()


if __name__ == "__main__":
    main()
