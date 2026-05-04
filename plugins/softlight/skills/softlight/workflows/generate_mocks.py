import json
from typing import TypedDict

from scripts.call_mcp import call_mcp
from scripts.load_config import Config

from workflows.base import workflow


class GenerateMocksParams(TypedDict):
    input: str


@workflow
def generate_mocks(
    config: Config,
    params: GenerateMocksParams,
) -> None:
    """Generate visual sketch mocks for the live design conversation from captured screenshots."""
    call_mcp(
        config=config,
        tool="generate_mock_revision_actually",
        input=json.loads(params["input"]),
    )
