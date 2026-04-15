import json
import urllib.request

from scripts.load_config import Config


def post_transcripts(
    config: Config,
) -> None:
    if not config.transcripts:
        return

    payload = [
        {
            "messages": messages,
            "project_id": config.project_id,
            "session_id": session_id,
        }
        for session_id, messages in config.transcripts.items()
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
        timeout=30,
    )
