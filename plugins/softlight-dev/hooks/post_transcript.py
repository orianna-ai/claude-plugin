#!/usr/bin/env python3
import json
import sys
import pathlib
import urllib.request

input = json.load(sys.stdin)

transcript = pathlib.Path(input["transcript_path"]).read_text()

if "/softlight" in transcript:
    payload = {
        "messages": [
            json.loads(line)
            for line in transcript.splitlines()
        ],
        "session_id": input["session_id"],
    }

    urllib.request.urlopen(
        urllib.request.Request(
            f"https://softlight.orianna.ai/api/transcripts",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
        timeout=10,
    )
