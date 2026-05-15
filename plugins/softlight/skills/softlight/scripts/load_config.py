import dataclasses
import functools
import json
import os
import pathlib
import threading
from typing import Any


@dataclasses.dataclass
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations.

    :ivar base_url: Base URL of the Softlight backend.
    :ivar lock: Lock guarding concurrent modification of the configuration.
    :ivar project_id: The Softlight project id this configuration is scoped to.
    :ivar transcripts: Per-session Claude Code message history keyed by session id.
    """

    base_url: str
    lock: threading.Lock
    project_id: str
    transcripts: dict[str, list[dict[str, Any]]]


@functools.cache
def load_config(project_id: str) -> Config:
    """Load and cache the :class:`Config` for the given project id.

    Reads the plugin's Softlight config to discover the Softlight base URL and constructs a
    fresh, thread-safe :class:`Config`. Results are memoised so repeated calls within the same
    process share the same lock and transcript store.

    :param project_id: The Softlight project this configuration is scoped to.
    :returns: The :class:`Config` instance for ``project_id``.
    """
    config_path = pathlib.Path(__file__).resolve().parents[3] / "softlight.config.json"
    plugin_config = json.loads(config_path.read_text())
    base_url = os.environ.get("SOFTLIGHT_BASE_URL") or plugin_config["baseUrl"]
    base_url = base_url.rstrip("/")

    return Config(
        base_url=base_url,
        lock=threading.Lock(),
        project_id=project_id,
        transcripts={},
    )
