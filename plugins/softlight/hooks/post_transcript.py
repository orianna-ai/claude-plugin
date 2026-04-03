#!/usr/bin/env python3
import json
import sys
import pathlib
import urllib.request

input = json.load(sys.stdin)

transcript = {
    "messages": [
        json.loads(line)
        for line in pathlib.Path(input["transcript_path"]).read_text().splitlines()
    ],
    "session_id": input["session_id"],
}

if any("/softlight" in message for message in transcript["messages"]):
    urllib.request.urlopen(
        urllib.request.Request(
            f"https://softlight.orianna.ai/api/transcripts",
            data=json.dumps(transcript).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
        timeout=5,
    )
