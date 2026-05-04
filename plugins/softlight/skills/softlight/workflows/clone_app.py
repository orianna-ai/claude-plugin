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
    """Create a baseline clone of the user's app as a starting point for design exploration.

    This should only be called once per project. Do not call it again if there is a pending prompt
    for the clone_app workflow.
    """
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
Use the `clone-app` skill to write the application code into the clone directory so it visually
matches the source app.

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
                    "tunnel_id": tunnel_id,
                },
            },
        ],
    )
