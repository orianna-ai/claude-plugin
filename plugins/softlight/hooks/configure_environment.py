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

if not env_file.exists() or "CLAUDE_CODE_SESSION_START_EVENT" not in env_file.read_text():
    with env_file.open("a") as f:
        f.write(f"export CLAUDE_CODE_SESSION_START_EVENT={shlex.quote(input)}\n")
        f.write("export PYTHONUNBUFFERED=1\n")
