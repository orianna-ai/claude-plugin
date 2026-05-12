from __future__ import annotations

import functools
import json
import os
import shlex
import string
import subprocess
import tempfile
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


def _read_stderr_tail(
    stderr_file: Any,
    *,
    max_chars: int = 12_000,
) -> str:
    stderr_file.flush()
    stderr_file.seek(0)
    stderr = stderr_file.read()
    if len(stderr) <= max_chars:
        return stderr
    return stderr[-max_chars:]


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
    """Invoke the ``claude`` CLI as a subprocess and stream its output to stdout.

    The prompt is sent over stdin as stream-json. ``$``-style placeholders in any string
    items are substituted using ``params``. Sessions are automatically scoped to the project so
    transcripts from different projects never collide.

    .. code-block::

        # plain-text prompt
        call_claude(
            config,
            prompt=[
                "Summarize the project's goals in one sentence.",
            ],
        )

        # parameterized prompt
        call_claude(
            config,
            prompt=[
                "Write a haiku about $topic.",
            ],
            params={
                "topic": "frontend tooling",
            },
        )

        # structured output
        output = call_claude(
            config,
            prompt=[
                "List three colors that pair well with navy.",
            ],
            json_schema={
                "type": "object",
                "properties": {
                    "colors": {
                        "type": "array",
                        "items": {
                            "type": "string",
                        },
                    },
                },
                "required": [
                    "colors",
                ],
            },
        )

        print(output["colors"])

        # prompt with images
        call_claude(
            config,
            prompt=[
                "Describe the mood of this screenshot in one sentence each.",
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": screenshot_url,
                    },
                },
            ],
        )

    :param config: Project configuration.
    :param prompt: Text or content blocks for the user turn.
    :param allowed_tools: Optional whitelist forwarded to ``--allowed-tools``.
    :param disallowed_tools: Additional tools to block. ``AskUserQuestion`` is always disallowed.
    :param effort: Optional reasoning-effort tier (``low`` through ``max``).
    :param fork_session: Whether to inherit the context window of the current Claude session.
    :param json_schema: Shape of the structured output Claude is expected to return.
    :param model: Optional model override forwarded to ``--model``.
    :param params: Substitution values for ``string.Template`` placeholders in ``prompt``.
    :param parent_session_id: Session id whose prior messages should be replayed as context.
    :param session_id: Session id under which to record this turn's messages.
    :param tools: Explicit tool list forwarded to ``--tools`` (an empty list disables all tools).
    :returns: The final text result, or the parsed structured output when ``json_schema`` is set.
    :raises RuntimeError: If Claude reports an error result, or exits without emitting one.
    """
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

    # Run claude code as a subprocess and stream the output in real-time. Keep stderr
    # in a temp file so subprocess crashes include useful diagnostics without risking
    # a pipe deadlock.
    with tempfile.TemporaryFile(mode="w+t") as stderr_file:
        with subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr_file,
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
                        stderr_tail = _read_stderr_tail(stderr_file)
                        raise RuntimeError(
                            f"{last_message['result']}\n\n"
                            f"Claude stderr:\n{stderr_tail or '(empty)'}\n\n"
                            f"{_claude_code_command(cmd, stdin)}",
                        )
                    elif json_schema:
                        return last_message["structured_output"]
                    else:
                        return last_message["result"]

        stderr_tail = _read_stderr_tail(stderr_file)

    raise RuntimeError(
        "claude did not emit a result message\n\n"
        f"Claude stderr:\n{stderr_tail or '(empty)'}\n\n"
        f"{_claude_code_command(cmd, stdin)}",
    )
