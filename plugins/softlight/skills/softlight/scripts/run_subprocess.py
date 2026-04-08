import argparse
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
    env: dict[str, str] | None = None,
    input: str | None = None,
    timeout: int | None = None,
) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        cwd=_claude_code_cwd(),
        env=env,
        input=input,
        text=True,
        timeout=timeout,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    else:
        return result.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "cmd",
        nargs="+",
        help="The command and arguments to run",
    )
    parser.add_argument(
        "--env",
        default=None,
        help="JSON string of environment variables to set",
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Input to send to the command's stdin",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help="Timeout in seconds",
    )
    args = parser.parse_args()

    run_subprocess(
        cmd=args.cmd,
        env=json.loads(args.env) if args.env else None,
        input=args.input,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    main()
