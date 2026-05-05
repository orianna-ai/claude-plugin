import pathlib
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.create_app import create_app
from scripts.load_config import Config
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow


class CloneAppParams(TypedDict):
    problem: str
    source_code_dir: str


@workflow
def clone_app(
    config: Config,
    params: CloneAppParams,
) -> None:
    """Create a baseline clone of the user's app as a starting point for design exploration."""
    source_code_dir = pathlib.Path(
        params["source_code_dir"],
    )

    cloned_code_dir = create_app(
        source_code_dir=source_code_dir,
    )

    call_claude(
        config=config,
        prompt=[
            """\
Use the `clone-app` skill to write a baseline clone into the clone directory so it visually
matches the source app as it exists right now.

This is only a clone task. The problem statement is context for finding the relevant current
screen/state to reproduce. Do not implement the requested feature, create design explorations,
start a tunnel, publish to the canvas, or modify the source app.

<problem>
${problem}
</problem>

<source_code_dir>
${source_code_dir}
</source_code_dir>

<cloned_code_dir>
${cloned_code_dir}
</cloned_code_dir>
""",
        ],
        params={
            "problem": params["problem"],
            "source_code_dir": str(source_code_dir),
            "cloned_code_dir": str(cloned_code_dir),
        },
        model="sonnet",
        effort="medium",
        session_id="clone_app",
        tools=[
            "Read",
            "Write",
            "Edit",
            "MultiEdit",
            "Glob",
            "Grep",
            "LS",
            "Bash",
        ],
        allowed_tools=[
            "Read",
            "Write",
            "Edit",
            "MultiEdit",
            "Glob",
            "Grep",
            "LS",
            "Bash(pnpm install:*)",
            "Bash(pnpm build:*)",
            "Bash(mkdir:*)",
            "Bash(cp:*)",
        ],
    )

    tunnel_id = str(uuid.uuid4())

    run_app(
        config=config,
        source_code_dir=cloned_code_dir,
        tunnel_id=tunnel_id,
    )

    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "baseline": {
                    "source_code_dir": str(cloned_code_dir),
                    "tunnel_id": tunnel_id,
                },
            },
        ],
    )
