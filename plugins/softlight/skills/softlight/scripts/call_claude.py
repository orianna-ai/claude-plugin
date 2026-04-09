import functools
import json
import os
import shlex
from typing import Any, Literal, overload

from scripts.run_subprocess import run_subprocess

_ENABLE_PROMPT_LOGGING = False
_DEFAULT_PROMPT_TIMEOUT = 300


@functools.cache
def _claude_code_session_start_event() -> dict[str, Any]:
    if session_start_event := os.environ.get("CLAUDE_CODE_SESSION_START_EVENT"):
        return json.loads(session_start_event)
    else:
        return {}


@functools.cache
def _claude_code_session_id() -> str | None:
    session_start_event = _claude_code_session_start_event()
    return session_start_event.get("session_id")


@overload
def call_claude(
    prompt: str,
    *,
    add_dirs: list[str] | None = ...,
    allowed_tools: list[str] | None = ...,
    effort: Literal["low", "medium", "high", "max"] | None = ...,
    fork_session: bool = ...,
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
    add_dirs: list[str] | None = ...,
    allowed_tools: list[str] | None = ...,
    effort: Literal["low", "medium", "high", "max"] | None = ...,
    fork_session: bool = ...,
    json_schema: None = ...,
    model: str | None = ...,
    system_prompt: str | None = ...,
    timeout: int | None = ...,
    tools: list[str] | None = None,
) -> str: ...


def call_claude(
    prompt: str,
    *,
    add_dirs: list[str] | None = None,
    allowed_tools: list[str] | None = None,
    effort: Literal["low", "medium", "high", "max"] | None = None,
    fork_session: bool = True,
    json_schema: dict[str, Any] | None = None,
    model: str | None = None,
    system_prompt: str | None = None,
    timeout: int | None = None,
    tools: list[str] | None = None,
) -> str | dict[str, Any]:
    cmd = [
        "claude",
        "-p",
        "--no-session-persistence",
    ]

    if fork_session:
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
                *(tools if tools else [""]),
            ],
        )

    if allowed_tools:
        cmd.extend(
            [
                "--allowed-tools",
                *allowed_tools,
            ],
        )

    if add_dirs:
        cmd.extend(
            [
                "--add-dir",
                *add_dirs,
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

    result = run_subprocess(
        cmd=cmd,
        env={
            **{var: val for var, val in os.environ.items() if var != "CLAUDECODE"},
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        },
        input=prompt,
        timeout=timeout or _DEFAULT_PROMPT_TIMEOUT,
    )

    if json_schema:
        return json.loads(result)["structured_output"]
    else:
        return result
