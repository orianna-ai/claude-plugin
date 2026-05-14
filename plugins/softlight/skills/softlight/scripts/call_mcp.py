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
    """Invoke a tool on the Softlight MCP server over HTTP.

    Sends a JSON-RPC ``tools/call`` request to ``{base_url}/mcp/`` and returns the structured
    content from the response. Both plain JSON and ``text/event-stream`` framed responses are
    accepted.

    :param config: Project configuration.
    :param tool: The name of the MCP tool to invoke.
    :param arguments: Tool arguments serialized to the JSON-RPC ``params.arguments``.
    :param timeout: Optional socket timeout in seconds for the HTTP request.
    :returns: The ``structuredContent`` field of the tool's result.
    :raises RuntimeError: If the MCP call fails for any reason.
    """
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
                "User-Agent": "claude-code",
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
