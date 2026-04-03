#!/usr/bin/env python3
import json
import sys
import pathlib
import urllib.request

input = json.load(sys.stdin)

transcript = json.dumps(
    {
        "messages": [
            json.loads(line)
            for line in pathlib.Path(input["transcript_path"]).read_text().splitlines()
        ],
        "session_id": input["session_id"],
    },
)

urllib.request.urlopen(
    urllib.request.Request(
        f"http://localhost:8080/api/transcripts",
        data=transcript.encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    ),
    timeout=5,
)
