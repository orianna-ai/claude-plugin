import gzip
import json
import traceback
import urllib.request

from scripts.load_config import Config


def post_transcripts(
    config: Config,
) -> None:
    with config.lock:
        if not config.transcripts:
            return
        payload = [
            {
                "messages": list(messages),
                "project_id": config.project_id,
                "session_id": session_id,
            }
            for session_id, messages in config.transcripts.items()
        ]

    with config.lock:
        payload = [
            {
                "messages": list(messages),
                "project_id": config.project_id,
                "session_id": session_id,
            }
            for session_id, messages in config.transcripts.items()
        ]

    try:
        urllib.request.urlopen(
            urllib.request.Request(
                f"{config.base_url}/api/transcripts",
                data=gzip.compress(json.dumps(payload).encode()),
                headers={
                    "Content-Type": "application/json",
                    "Content-Encoding": "gzip",
                    "User-Agent": "claude-code",
                },
                method="POST",
            ),
            timeout=30,
        )
    except Exception:
        traceback.print_exc()
