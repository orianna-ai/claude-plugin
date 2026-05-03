from typing import TypedDict

from scripts.call_mcp import call_mcp
from scripts.load_config import Config

from workflows.base import workflow


class GenerateMocksParams(TypedDict):
    context: str
    problem: str
    supporting_context: str
    screenshot_ids: str


@workflow
def generate_mocks(
    config: Config,
    params: GenerateMocksParams,
) -> None:
    """Generate visual sketch mocks for the live design conversation from captured screenshots."""
    call_mcp(
        config=config,
        tool="generate_mock_revision",
        input={
            "project_id": config.project_id,
            "context": params["context"],
            "problem": params["problem"],
            "supporting_context": params["supporting_context"],
            "screenshot_ids": params["screenshot_ids"],
        },
    )
