#!/usr/bin/env python3
import json
import os
import pathlib
import shlex
import sys

input = sys.stdin.read()

print(
    json.dumps(
        {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": f"CLAUDE_CODE_SESSION_START_EVENT={input}",
            },
        },
    ),
)

env_file = pathlib.Path(os.environ["CLAUDE_ENV_FILE"])

env = env_file.read_text() if env_file.exists() else ""

with env_file.open("a") as file:
    if "CLAUDE_CODE_SESSION_START_EVENT" not in env:
        file.write(f"export CLAUDE_CODE_SESSION_START_EVENT={shlex.quote(input)}\n")

    if "CLAUDE_CODE_EFFORT_LEVEL" not in env:
        file.write("export CLAUDE_CODE_EFFORT_LEVEL=max\n")

    if "PYTHONUNBUFFERED" not in env:
        file.write("export PYTHONUNBUFFERED=1\n")
