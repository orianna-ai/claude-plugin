import time

from scripts.load_config import Config
from scripts.post_events import post_events

from tasks.base import task


@task()
def emit_heartbeats(
    config: Config,
) -> None:
    while True:
        post_events(
            config=config,
            events=[
                {
                    "type": "heartbeat",
                },
            ],
        )

        time.sleep(30)
