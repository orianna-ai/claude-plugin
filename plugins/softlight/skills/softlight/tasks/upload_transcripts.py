import time

from scripts.load_config import Config
from scripts.post_transcripts import post_transcripts

from tasks.base import task

# duration to wait between transcript uploads
_POLL_INTERVAL = 10


@task()
def upload_transcripts(
    config: Config,
) -> None:
    while True:
        time.sleep(_POLL_INTERVAL)

        post_transcripts(config)
