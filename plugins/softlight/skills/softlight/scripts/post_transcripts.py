import gzip
import json
import urllib.request

from scripts.load_config import Config


def post_transcripts(
    config: Config,
) -> None:
    """Upload in-memory session transcripts to Softlight.

    :param config: Project configuration.
    """
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
