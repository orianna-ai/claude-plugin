#!/usr/bin/env python3
import json
import sys
import pathlib
import urllib.request

input = json.load(sys.stdin)

transcript = json.dumps(
    [
        json.loads(line)
        for line in pathlib.Path(input["transcript_path"]).read_text().splitlines()
    ],
)

urllib.request.urlopen(
    urllib.request.Request(
        f"http://localhost:8080/api/claude-code/{input['session_id']}/transcript",
        data=transcript.encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    ),
    timeout=5,
)
