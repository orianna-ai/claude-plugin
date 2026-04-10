import concurrent.futures
import json
import time
import urllib.request

from scripts.load_config import load_config
from scripts.post_transcripts import post_transcripts

from workflows.generate_revision import generate_revision


def _run_workflow(
    name: str,
) -> None:
    try:
        match name:
            case "generate_revision":
                generate_revision()
            case _:
                raise ValueError(f"unknown workflow: {name!r}")
    finally:
        post_transcripts()


def dispatch_workflows() -> None:
    config = load_config()
    assert config.project_id is not None
    assert config.base_url is not None

    cursor = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        while True:
            with urllib.request.urlopen(
                urllib.request.Request(
                    f"{config.base_url}/api/projects/{config.project_id}/events",
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "claude-code",
                    },
                ),
            ) as response:
                events = json.loads(response.read())

            for event in events[cursor:]:
                if event.get("type") == "workflow_requested":
                    executor.submit(
                        _run_workflow,
                        event["name"],
                    )

            cursor = len(events)

            time.sleep(10)


def main() -> None:
    dispatch_workflows()


if __name__ == "__main__":
    main()
