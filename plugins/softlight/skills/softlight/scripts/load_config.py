import dataclasses
import functools
import json
import pathlib
import threading
from typing import Any


@dataclasses.dataclass
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations.

    :ivar base_url: Base URL of the Softlight backend.
    :ivar lock: Lock guarding concurrent modification of the configuration.
    :ivar mcp_config: Parsed contents of the plugin's ``.mcp.json``.
    :ivar mcp_config_path: Filesystem path to the plugin's ``.mcp.json``.
    :ivar project_id: The Softlight project id this configuration is scoped to.
    :ivar transcripts: Per-session Claude Code message history keyed by session id.
    """

    base_url: str
    lock: threading.Lock
    mcp_config: dict[str, Any]
    mcp_config_path: pathlib.Path
    project_id: str
    transcripts: dict[str, list[dict[str, Any]]]


@functools.cache
def load_config(project_id: str) -> Config:
    """Load and cache the :class:`Config` for the given project id.

    Reads the plugin's ``.mcp.json`` to discover the Softlight base URL and constructs a fresh,
    thread-safe :class:`Config`. Results are memoised so repeated calls within the same process
    share the same lock and transcript store.

    :param project_id: The Softlight project this configuration is scoped to.
    :returns: The :class:`Config` instance for ``project_id``.
    """
    mcp_config_path = pathlib.Path(__file__).resolve().parents[3] / ".mcp.json"
    mcp_config = json.loads(mcp_config_path.read_text())
    base_url = mcp_config["mcpServers"]["softlight"]["args"][-1].removesuffix("/mcp/")

    return Config(
        base_url=base_url,
        lock=threading.Lock(),
        mcp_config=mcp_config,
        mcp_config_path=mcp_config_path,
        project_id=project_id,
        transcripts={},
    )
