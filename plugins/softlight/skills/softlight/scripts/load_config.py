import dataclasses
import functools
import json
import pathlib
from typing import Any


@dataclasses.dataclass(kw_only=True)
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations."""

    base_url: str
    mcp_config_path: pathlib.Path
    project_id: str
    transcripts: dict[str, list[dict[str, Any]]]


def _base_url(mcp_config_path: pathlib.Path) -> str:
    mcp_json = json.loads(mcp_config_path.read_text())
    mcp_server = mcp_json["mcpServers"]["softlight"]["args"][-1]
    return mcp_server.removesuffix("/mcp/")


@functools.cache
def load_config(project_id: str) -> Config:
    mcp_config_path = pathlib.Path(__file__).resolve().parents[3] / ".mcp.json"
    return Config(
        base_url=_base_url(mcp_config_path),
        mcp_config_path=mcp_config_path,
        project_id=project_id,
        transcripts={},
    )
