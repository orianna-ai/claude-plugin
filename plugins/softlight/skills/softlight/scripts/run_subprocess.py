import functools
import json
import os
import subprocess
from typing import Any


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


def run_subprocess(
    cmd: list[str],
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    input: str | None = None,
    timeout: int | None = None,
) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        cwd=cwd or _claude_code_cwd(),
        env=env,
        input=input,
        text=True,
        timeout=timeout,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    else:
        return result.stdout.strip()
