#!/usr/bin/env python3
import os
import pathlib
import shlex
import sys

input = sys.stdin.read()

env_file = pathlib.Path(os.environ["CLAUDE_ENV_FILE"])

env = env_file.read_text() if env_file.exists() else ""

plugin_dir = pathlib.Path(__file__).resolve().parent.parent

with env_file.open("a") as file:
    file.write(f"export CLAUDE_CODE_SESSION_START_EVENT={shlex.quote(input)}\n")

    if "PYTHONUNBUFFERED" not in env:
        file.write("export PYTHONUNBUFFERED=1\n")

    if "PYTHONPATH" not in env:
        file.write(f"export PYTHONPATH={shlex.quote(str(plugin_dir / 'skills' / 'softlight'))}\n")
