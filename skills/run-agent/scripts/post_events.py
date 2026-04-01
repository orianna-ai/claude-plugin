import argparse
import json
import urllib.request
from typing import Any

from scripts.load_config import load_config


def post_events(
    events: list[dict[str, Any]],
) -> None:
    config = load_config()

    if config.project_id is None or config.base_url is None:
        raise ValueError("`project_id` and `base_url` must both be configured to post events")

    request = urllib.request.Request(
        f"{config.base_url}/api/projects/{config.project_id}/events",
        data=json.dumps(events).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request) as response:
        if response.status != 200:
            raise RuntimeError(f"failed to post events to softlight {response.status}")

        response.read()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "events",
        help="JSON-encoded events to post",
        required=True,
    )
    args = parser.parse_args()

    post_events(
        events=json.loads(args.events),
    )


if __name__ == "__main__":
    main()
