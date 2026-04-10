from typing import Any, overload

from scripts.call_claude import call_claude

_DEFAULT_MCP_TIMEOUT = 120


@overload
def call_mcp(
    tool: str,
    input: dict[str, str],
    *,
    json_schema: dict[str, Any],
    timeout: int | None = ...,
) -> dict[str, Any]: ...


@overload
def call_mcp(
    tool: str,
    input: dict[str, str],
    *,
    json_schema: None = ...,
    timeout: int | None = ...,
) -> str: ...


def call_mcp(
    tool: str,
    input: dict[str, str],
    *,
    json_schema: dict[str, Any] | None = None,
    timeout: int | None = None,
) -> str | dict[str, Any]:
    args = "\n".join(
        [
            "- `input`:",
            *(f"    - `{k}`: {v}" for k, v in input.items()),
        ],
    )

    return call_claude(
        prompt=f"""\
Call the `mcp__plugin_softlight_softlight__{tool}` MCP tool with these exact arguments:
{args}
""",
        allowed_tools=[f"mcp__plugin_softlight_softlight__{tool}"],
        effort="low",
        json_schema=json_schema,
        model="haiku",
        timeout=timeout or _DEFAULT_MCP_TIMEOUT,
        tools=[],
    )
