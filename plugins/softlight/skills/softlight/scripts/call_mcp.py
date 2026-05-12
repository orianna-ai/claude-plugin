from __future__ import annotations

import json
import urllib.request
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from scripts.load_config import Config


def _parse_mcp_response(
    raw: bytes,
) -> dict[str, Any]:
    text = raw.decode()
    if text.lstrip().startswith("{"):
        return json.loads(text)

    for line in text.splitlines():
        if line.startswith("data:"):
            data = line.removeprefix("data:").strip()
            if data and data != "[DONE]":
                return json.loads(data)

    raise RuntimeError(f"MCP response did not contain JSON: {text[:500]}")


def call_mcp(
    config: Config,
    tool: str,
    arguments: dict[str, Any],
    *,
    timeout: int | None = None,
) -> dict[str, Any]:
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{config.base_url}/mcp/",
            data=json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {"name": tool, "arguments": arguments},
                },
            ).encode(),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
        ),
        timeout=timeout,
    ) as response:
        payload = _parse_mcp_response(response.read())

    if error := payload.get("error"):
        raise RuntimeError(f"{tool} failed: {error.get('message', error)}")

    result = payload["result"]

    if result.get("isError"):
        raise RuntimeError(f"{tool} failed: {result}")

    return result["structuredContent"]
