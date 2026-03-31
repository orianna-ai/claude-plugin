#!/usr/bin/env python3
import argparse
import json
import os
import shlex
import functools
import subprocess
from typing import Any, overload

_ENABLE_PROMPT_LOGGING = False


@functools.cache
def _claude_code_session_start_event() -> dict[str, Any]:
    if session_start_event := os.environ.get("CLAUDE_CODE_SESSION_START_EVENT"):
        return json.loads(session_start_event)
    else:
        return {}


@functools.cache
def _claude_code_cwd() -> str | None:
    session_start_event = _claude_code_session_start_event()
    return session_start_event.get("cwd")


@functools.cache
def _claude_code_session_id() -> str | None:
    session_start_event = _claude_code_session_start_event()
    return session_start_event.get("session_id")


@overload
def call_claude(
    prompt: str,
    *,
    allowed_tools: list[str] | None = None,
    effort: str | None = ...,
    fork: bool = ...,
    json_schema: dict[str, Any],
    model: str | None = ...,
    system_prompt: str | None = ...,
    timeout: int | None = ...,
    tools: list[str] | None = None,
) -> dict[str, Any]: ...


@overload
def call_claude(
    prompt: str,
    *,
    allowed_tools: list[str] | None = None,
    effort: str | None = ...,
    fork: bool = ...,
    json_schema: None = ...,
    model: str | None = ...,
    system_prompt: str | None = ...,
    timeout: int | None = ...,
    tools: list[str] | None = None,
) -> str: ...


def call_claude(
    prompt: str,
    *,
    allowed_tools: list[str] | None = None,
    effort: str | None = None,
    fork: bool = True,
    json_schema: dict[str, Any] | None = None,
    model: str | None = None,
    system_prompt: str | None = None,
    timeout: int | None = None,
    tools: list[str] | None = None,
) -> str | dict[str, Any]:
    cmd = [
        "claude",
        "-p",
    ]

    if fork:
        if session_id := _claude_code_session_id():
            cmd.extend(
                [
                    "--resume",
                    session_id,
                ],
            )

        cmd.append("--fork-session")
        
    if system_prompt:
        cmd.extend(
            [
                "--system-prompt",
                system_prompt,
            ],
        )

    if effort:
        cmd.extend(
            [
                "--effort",
                effort,
            ],
        )

    if model:
        cmd.extend(
            [
                "--model",
                model,
            ],
        )

    if tools is not None:
        cmd.extend(
            [
                "--tools",
                *tools,
            ],
        )

    if allowed_tools:
        cmd.extend(
            [
                "--allowed-tools",
                *allowed_tools,
            ],
        )

    if json_schema:
        cmd.extend(
            [
                "--json-schema",
                json.dumps(json_schema),
                "--output-format",
                "json",
            ],
        )

    prompt = prompt.strip()

    if _ENABLE_PROMPT_LOGGING:
        print(shlex.join(cmd) + f" <<'EOF'\n{prompt}\nEOF")

    result = subprocess.run(
        cmd,
        capture_output=True,
        cwd=_claude_code_cwd(),
        env={
            **{
                var: val for var, val in os.environ.items()
                if var != "CLAUDECODE"
            },
            **{
                "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
            },
        },
        input=prompt,
        text=True,
        timeout=timeout or 300,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    elif json_schema:
        return json.loads(result.stdout)["structured_output"]
    else:
        return result.stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--prompt",
        required=True,
        help="The prompt to send to Claude",
    )
    parser.add_argument(
        "--allowed-tools",
        nargs="*",
        default=None,
        help="Tools to allow without requiring user approval",
    )
    parser.add_argument(
        "--effort",
        default=None,
        help="Thinking effort level (e.g. 'low', 'medium', 'high')",
    )
    parser.add_argument(
        "--json-schema",
        default=None,
        help="JSON schema string to enforce structured output",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Model to use (e.g. 'haiku', 'sonnet', 'opus')",
    )
    parser.add_argument(
        "--system-prompt",
        default=None,
        help="System prompt to set context for Claude",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help="Timeout in seconds (default: 300)",
    )
    parser.add_argument(
        "--tools",
        nargs="*",
        default=None,
        help="Tools to make available to Claude",
    )
    args = parser.parse_args()

    call_claude(
        prompt=args.prompt,
        allowed_tools=args.allowed_tools,
        effort=args.effort,
        json_schema=json.loads(args.json_schema) if args.json_schema else None,
        model=args.model,
        system_prompt=args.system_prompt,
        timeout=args.timeout,
        tools=args.tools,
    )


if __name__ == "__main__":
    main()
