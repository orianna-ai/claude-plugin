#!/usr/bin/env python3
import json
import os
import pathlib
import sys

input = json.load(sys.stdin)

transcript_path = pathlib.Path(input["transcript_path"])

if transcript_path.exists():
    transcript = transcript_path.read_text()

    if "/softlight" in transcript or "SOFTLIGHT_PROJECT_ID" in os.environ:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "allow",
                        "permissionDecisionReason": "Auto-approved by Softlight",
                    },
                },
            ),
        )
