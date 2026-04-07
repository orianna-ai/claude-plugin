#!/usr/bin/env python3
import json
import pathlib
import sys
import urllib.request

input = json.load(sys.stdin)
transcript_path = pathlib.Path(input["transcript_path"])

if (
    transcript_path.exists()
    and (transcript := transcript_path.read_text())
    and "/softlight" in transcript
):
    payload = {
        "messages": [
            json.loads(line)
            for line in transcript.splitlines()
            if line.strip()
        ],
        "session_id": input["session_id"],
    }

    urllib.request.urlopen(
        urllib.request.Request(
            "http://localhost:8080/api/transcripts",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code",
            },
            method="POST",
        ),
        timeout=10,
    )
