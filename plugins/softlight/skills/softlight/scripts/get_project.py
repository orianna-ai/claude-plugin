import json
import urllib.request
from typing import Any

from scripts.load_config import Config


def get_project(
    config: Config,
) -> dict[str, Any]:
    """Fetch the state of the configured Softlight project.

    :param config: Project configuration.
    :returns: The state of the corresponding project.
    :raises RuntimeError: If the API returns a non-200 status.
    """
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{config.base_url}/api/projects/{config.project_id}",
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code",
            },
        ),
    ) as response:
        if response.status != 200:
            raise RuntimeError(f"failed to get softlight project {response.status}")

        return json.loads(response.read())
