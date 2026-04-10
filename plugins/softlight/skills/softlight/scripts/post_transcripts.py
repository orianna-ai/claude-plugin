import json
import urllib.request

from scripts.load_config import load_config


def post_transcripts() -> None:
    config = load_config()

    if not config.transcripts:
        return

    payload = [
        {
            "messages": [json.loads(line) for line in transcript.splitlines()],
            "project_id": config.project_id,
            "session_id": session_id,
        }
        for session_id, transcript in config.transcripts.items()
    ]

    request = urllib.request.Request(
        f"{config.base_url}/api/transcripts",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "claude-code",
        },
        method="POST",
    )

    urllib.request.urlopen(
        request,
        timeout=10,
    )
