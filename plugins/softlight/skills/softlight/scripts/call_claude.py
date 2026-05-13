from __future__ import annotations

import datetime
import functools
import json
import os
import pathlib
import shlex
import string
import subprocess
from typing import TYPE_CHECKING, Any, Literal, overload

if TYPE_CHECKING:
    from collections.abc import Mapping

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


def _claude_code_command(
    cmd: list[str],
    stdin: str,
) -> str:
    sh = shlex.join(cmd)

    if cwd := _claude_code_cwd():
        sh = f"cd {shlex.quote(cwd)} && {sh}"

    return f"{sh} <<'EOF'\n{stdin}\nEOF"


@functools.cache
def _actual_plugin_dir() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


@functools.cache
def _harness_plugin_stamp() -> dict[str, Any]:
    stamp_path = _actual_plugin_dir() / ".softlight-harness-plugin.json"
    if not stamp_path.exists():
        return {}
    return json.loads(stamp_path.read_text())


def _diagnostic_log_path() -> pathlib.Path | None:
    path = os.environ.get("SOFTLIGHT_HARNESS_PLUGIN_DIAGNOSTIC_LOG")
    if not path:
        path = _harness_plugin_stamp().get("diagnostic_log_path")
    return pathlib.Path(path) if path else None


def _expected_plugin_dir() -> str | None:
    if path := os.environ.get("SOFTLIGHT_HARNESS_EXPECTED_PLUGIN_DIR"):
        return str(pathlib.Path(path).resolve())
    if path := _harness_plugin_stamp().get("expected_plugin_dir"):
        return str(pathlib.Path(path).resolve())
    return None


def _command_plugin_dir(cmd: list[str]) -> str | None:
    try:
        index = cmd.index("--plugin-dir")
    except ValueError:
        return None

    try:
        return cmd[index + 1]
    except IndexError:
        return ""


def _append_diagnostic_event(event: dict[str, Any]) -> None:
    log_path = _diagnostic_log_path()
    if log_path is None:
        return

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a") as file:
        file.write(json.dumps(event, sort_keys=True) + "\n")


def _stamp_claude_spawn(
    *,
    cmd: list[str],
    config: Config,
    parent_session_id: str | None,
    session_id: str | None,
) -> None:
    actual_plugin_dir = str(_actual_plugin_dir())
    expected_plugin_dir = _expected_plugin_dir()
    command_plugin_dir = _command_plugin_dir(cmd)
    resolved_command_plugin_dir = (
        str(pathlib.Path(command_plugin_dir).resolve())
        if command_plugin_dir
        else command_plugin_dir
    )
    mismatches = []

    if expected_plugin_dir and actual_plugin_dir != expected_plugin_dir:
        mismatches.append("call_claude_script_loaded_from_unexpected_plugin_dir")

    if expected_plugin_dir and resolved_command_plugin_dir != expected_plugin_dir:
        if command_plugin_dir is None:
            mismatches.append("inner_claude_command_missing_plugin_dir")
        else:
            mismatches.append("inner_claude_command_plugin_dir_mismatch")

    stamp = _harness_plugin_stamp()
    _append_diagnostic_event(
        {
            "actual_plugin_dir": actual_plugin_dir,
            "command_plugin_dir": command_plugin_dir,
            "cwd": _claude_code_cwd(),
            "event": "call_claude_spawn",
            "expected_plugin_dir": expected_plugin_dir,
            "mcp_config_path": str(config.mcp_config_path),
            "mismatches": mismatches,
            "parent_session_id": parent_session_id,
            "project_id": config.project_id,
            "session_id": session_id,
            "source_plugin_dir": os.environ.get("SOFTLIGHT_HARNESS_SOURCE_PLUGIN_DIR")
            or stamp.get("source_plugin_dir"),
            "status": "mismatch" if mismatches else "ok",
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        },
    )


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
    prompt: list[str | dict[str, Any]],
    *,
    allowed_tools: list[str] | None = ...,
    disallowed_tools: list[str] | None = ...,
    effort: _Effort | None = ...,
    fork_session: bool = ...,
    json_schema: dict[str, Any],
    model: str | None = ...,
    params: Mapping[str, Any] | None = ...,
    parent_session_id: str | None = ...,
    session_id: str | None = ...,
    tools: list[str] | None = None,
) -> dict[str, Any]: ...


@overload
def call_claude(
    config: Config,
    prompt: list[str | dict[str, Any]],
    *,
    allowed_tools: list[str] | None = ...,
    disallowed_tools: list[str] | None = ...,
    effort: _Effort | None = ...,
    fork_session: bool = ...,
    json_schema: None = ...,
    model: str | None = ...,
    params: Mapping[str, Any] | None = ...,
    parent_session_id: str | None = ...,
    session_id: str | None = ...,
    tools: list[str] | None = None,
) -> str: ...


def call_claude(
    config: Config,
    prompt: list[str | dict[str, Any]],
    *,
    allowed_tools: list[str] | None = None,
    disallowed_tools: list[str] | None = None,
    effort: _Effort | None = None,
    fork_session: bool = True,
    json_schema: dict[str, Any] | None = None,
    model: str | None = None,
    params: Mapping[str, Any] | None = None,
    parent_session_id: str | None = None,
    session_id: str | None = None,
    tools: list[str] | None = None,
) -> str | dict[str, Any]:
    # prepend the project id to the session id
    if parent_session_id is not None:
        parent_session_id = f"{config.project_id}:{parent_session_id}"

    if session_id is not None:
        session_id = f"{config.project_id}:{session_id}"

    # assemble the claude code command
    cmd = [
        "claude",
        "-p",
        "--dangerously-skip-permissions",
        "--exclude-dynamic-system-prompt-sections",
        "--input-format",
        "stream-json",
        "--mcp-config",
        str(config.mcp_config_path),
        "--strict-mcp-config",
        "--no-chrome",
        "--no-session-persistence",
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

    cmd.extend(
        [
            "--disallowed-tools",
            "AskUserQuestion",
            *(disallowed_tools or []),
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

    with config.lock:
        if parent_session_id is not None:
            input.extend(config.transcripts[parent_session_id])

        if session_id is not None and session_id in config.transcripts:
            input.extend(config.transcripts[session_id])

        content = [
            {
                "type": "text",
                "text": f"You are an agent working on Softlight project {config.project_id}.",
            },
        ]

        for item in prompt:
            if isinstance(item, str):
                content.append(
                    {
                        "type": "text",
                        "text": string.Template(item).safe_substitute(params or {}).strip(),
                    },
                )
            elif isinstance(item, dict):
                content.append(item)

        user_message = {
            "type": "user",
            "message": {
                "role": "user",
                "content": content,
            },
        }

        if session_id is not None:
            if session_id in config.transcripts:
                config.transcripts[session_id].append(user_message)
            else:
                config.transcripts[session_id] = [user_message]

        input.append(user_message)

    stdin = "\n".join(json.dumps(message) for message in input)
    _stamp_claude_spawn(
        cmd=cmd,
        config=config,
        parent_session_id=parent_session_id,
        session_id=session_id,
    )

    # run claude code as a subprocess and stream the output in real-time
    with subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        cwd=_claude_code_cwd(),
        env={
            **{var: val for var, val in os.environ.items() if var != "CLAUDECODE"},
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
            "CLAUDE_CODE_GLOB_NO_IGNORE": "false",
            "ENABLE_CLAUDEAI_MCP_SERVERS": "false",
            "MCP_CONNECTION_NONBLOCKING": "false",
            "MCP_TOOL_TIMEOUT": "300000",  # 5m
            "SOFTLIGHT_PROJECT_ID": config.project_id,
        },
        text=True,
    ) as claude_code:
        assert claude_code.stdin is not None
        claude_code.stdin.write(stdin)
        claude_code.stdin.close()

        assert claude_code.stdout is not None
        last_message: dict[str, Any] = {}

        for line in claude_code.stdout:
            print(line)

            last_message = json.loads(line.rstrip("\n"))

            if session_id is not None:
                with config.lock:
                    config.transcripts[session_id].append(last_message)

            if last_message.get("type") == "result":
                claude_code.terminate()

                if last_message.get("is_error"):
                    raise RuntimeError(
                        f"{last_message['result']}:\n{_claude_code_command(cmd, stdin)}",
                    )
                elif json_schema:
                    return last_message["structured_output"]
                else:
                    return last_message["result"]

    raise RuntimeError(
        f"claude did not emit a result message:\n{_claude_code_command(cmd, stdin)}",
    )
