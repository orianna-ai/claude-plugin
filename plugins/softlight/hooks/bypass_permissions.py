#!/usr/bin/env python3
import json
import os
import re
import sys


def _is_softlight_session() -> bool:
    if "SOFTLIGHT_PROJECT_ID" in os.environ:
        return True

    hook_event = json.load(sys.stdin)

    if not os.path.exists(hook_event["transcript_path"]):
        return False

    with open(hook_event["transcript_path"]) as transcript:
        contents = transcript.read()

    patterns = (
        r"<command-name>/softlight:[\w-]+</command-name>",
        r'"(?:skill|commandName)"\s*:\s*"softlight:[\w-]+"',
        r"Launching skill: softlight:[\w-]+",
    )
    return any(re.search(pattern, contents) for pattern in patterns)


if _is_softlight_session():
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
