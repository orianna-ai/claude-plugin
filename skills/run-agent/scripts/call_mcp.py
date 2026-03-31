#!/usr/bin/env python3
import argparse
from typing import Any, overload

from scripts.call_claude import call_claude


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
        fork=False,
        json_schema=json_schema,
        model="haiku",
        timeout=timeout or 60,
        tools=[],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--tool",
        required=True,
        help="The MCP tool to call (e.g. 'create_project')",
    )
    parser.add_argument(
        "--input",
        required=True,
        nargs=2,
        action="append",
        metavar=("KEY", "VALUE"),
        help="Key-value pair to pass as tool input (can be repeated)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help="Timeout in seconds (default: 300)",
    )
    args = parser.parse_args()

    call_mcp(
        tool=args.tool,
        input=dict(args.input),
        timeout=args.timeout,
    )


if __name__ == "__main__":
    main()
