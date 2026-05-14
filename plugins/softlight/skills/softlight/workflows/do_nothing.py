from typing import TypedDict

from scripts.load_config import Config

from workflows.base import workflow


class DoNothingParams(TypedDict):
    pass


@workflow()
def do_nothing(
    config: Config,
    params: DoNothingParams,
) -> None:
    """Do nothing. Pick this when no other workflow would meaningfully advance the project."""
