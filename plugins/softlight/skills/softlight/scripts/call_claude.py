import functools
import json
import os
import subprocess
from typing import Any, Literal, overload

from scripts.load_config import Config


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


@functools.cache
def _claude_code_cwd() -> str | None:
    session_start_event = _claude_code_session_start_event()
    return session_start_event.get("cwd")


_Effort = Literal[
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
]


@overload
def call_claude(
    config: Config,
    prompt: str,
    *,
    allowed_tools: list[str] | None = ...,
    effort: _Effort | None = ...,
    fork_session: bool = ...,
    json_schema: dict[str, Any],
    model: str | None = ...,
    parent_session_id: str | None = ...,
    session_id: str | None = ...,
    tools: list[str] | None = None,
) -> dict[str, Any]: ...


@overload
def call_claude(
    config: Config,
    prompt: str,
    *,
    allowed_tools: list[str] | None = ...,
    effort: _Effort | None = ...,
    fork_session: bool = ...,
    json_schema: None = ...,
    model: str | None = ...,
    parent_session_id: str | None = ...,
    session_id: str | None = ...,
    tools: list[str] | None = None,
) -> str: ...


def call_claude(
    config: Config,
    prompt: str,
    *,
    allowed_tools: list[str] | None = None,
    effort: _Effort | None = None,
    fork_session: bool = True,
    json_schema: dict[str, Any] | None = None,
    model: str | None = None,
    parent_session_id: str | None = None,
    session_id: str | None = None,
    tools: list[str] | None = None,
) -> str | dict[str, Any]:
    # assemble the claude code command
    cmd = [
        "claude",
        "-p",
        "--no-session-persistence",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
    ]

    if fork_session:
        if original_session_id := _claude_code_session_id():
            cmd.extend(
                [
                    "--resume",
                    original_session_id,
                ],
            )

        cmd.append("--fork-session")

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

    if json_schema:
        cmd.extend(
            [
                "--json-schema",
                json.dumps(json_schema),
            ],
        )

    # build the input context that will be passed to claude code
    input = []

    if parent_session_id is not None:
        input.extend(config.transcripts[parent_session_id])

    if session_id is not None and session_id in config.transcripts:
        input.extend(config.transcripts[session_id])

    input.append(
        {
            "type": "user",
            "message": {
                "role": "user",
                "content": prompt.strip(),
            },
        },
    )

    if session_id is not None:
        for message in input:
            if session_id in config.transcripts:
                config.transcripts[session_id].append(message)
            else:
                config.transcripts[session_id] = [message]

    # run claude code as a subprocess
    claude_code = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        cwd=_claude_code_cwd(),
        env={
            **{var: val for var, val in os.environ.items() if var != "CLAUDECODE"},
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
            "SOFTLIGHT_PROJECT_ID": config.project_id,
        },
        text=True,
    )

    assert claude_code.stdin is not None
    claude_code.stdin.write("\n".join([json.dumps(message) for message in input]))
    claude_code.stdin.close()

    # stream the claude code output so that transcripts update in real-time
    assert claude_code.stdout is not None
    last_message: dict[str, Any] = {}

    for line in claude_code.stdout:
        print(line)

        last_message = json.loads(line.rstrip("\n"))

        if session_id is not None:
            config.transcripts[session_id].append(last_message)

    # extract the result from the last message produced by claude code
    if last_message.get("is_error"):
        raise RuntimeError(last_message["result"])
    elif json_schema:
        return last_message["structured_output"]
    else:
        return last_message["result"]
