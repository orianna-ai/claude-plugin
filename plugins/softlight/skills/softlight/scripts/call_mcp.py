from __future__ import annotations

from typing import TYPE_CHECKING, Any, overload

from scripts.call_claude import call_claude

if TYPE_CHECKING:
    from scripts.load_config import Config


@overload
def call_mcp(
    config: Config,
    tool: str,
    input: dict[str, str],
    *,
    json_schema: dict[str, Any],
    timeout: int | None = ...,
) -> dict[str, Any]: ...


@overload
def call_mcp(
    config: Config,
    tool: str,
    input: dict[str, str],
    *,
    json_schema: None = ...,
    timeout: int | None = ...,
) -> str: ...


def call_mcp(
    config: Config,
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
        config=config,
        prompt=[
            f"""\
Call the `{tool}` MCP tool with these exact arguments:
{args}
""",
        ],
        allowed_tools=[tool],
        effort="low",
        fork_session=False,
        json_schema=json_schema,
        model="haiku",
        tools=[],
    )
