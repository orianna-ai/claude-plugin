import json
import urllib.request
from typing import Any

from scripts.load_config import Config


def post_events(
    config: Config,
    events: list[dict[str, Any]],
) -> None:
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{config.base_url}/api/projects/{config.project_id}/events",
            data=json.dumps(events).encode(),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code",
            },
            method="POST",
        ),
    ) as response:
        if response.status != 200:
            raise RuntimeError(f"failed to post events to softlight {response.status}")

        response.read()
