import time

from scripts.load_config import Config
from scripts.post_transcripts import post_transcripts

from tasks.base import task


@task
def upload_transcripts(
    config: Config,
) -> None:
    while True:
        time.sleep(10)

        post_transcripts(config)
