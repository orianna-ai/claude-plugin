import json
import uuid
from collections.abc import Iterator
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import Workflow, workflow
from workflows.clone_app import clone_app
from workflows.do_nothing import do_nothing
from workflows.live_intake_manager import live_intake_manager


class DispatchWorkflowParams(TypedDict):
    pass


def _candidate_workflows(
    project: dict[str, Any],
) -> Iterator[Workflow]:
    yield live_intake_manager

    if project.get("baseline") is None:
        yield clone_app

    yield do_nothing


@workflow
def dispatch_workflow(
    config: Config,
    params: DispatchWorkflowParams,
) -> None:
    """Pick the next workflow to run based on the project's current state."""
    project = get_project(config)

    candidate_workflows = list(_candidate_workflows(project))

    invocation_id = uuid.uuid4()

    decision = call_claude(
        prompt=[
            """\
Pick the workflow that best matches the project's current state and provide its parameters.

The project may have multiple `conversations` — each is a separate LiveKit session. Look across
all of them when deciding what to do next.

<workflows>
${workflows}
</workflows>

<project>
${project}
</project>
""",
        ],
        params={
            "project": json.dumps(project),
            "workflows": "\n".join(
                f"- {candidate_workflow.name}: {candidate_workflow.description}"
                for candidate_workflow in candidate_workflows
            ),
        },
        json_schema={
            "type": "object",
            "properties": {
                "next_workflow": {
                    "oneOf": [
                        {
                            "type": "object",
                            "properties": {
                                "workflow": {
                                    "type": "string",
                                    "const": candidate_workflow.name,
                                },
                                "params": candidate_workflow.schema,
                            },
                            "required": [
                                "workflow",
                                "params",
                            ],
                            "additionalProperties": False,
                        }
                        for candidate_workflow in candidate_workflows
                    ],
                },
            },
            "required": ["next_workflow"],
            "additionalProperties": False,
        },
        config=config,
        effort="low",
        model="opus",
        session_id=f"dispatch_workflow:{invocation_id}",
    )

    post_events(
        config=config,
        events=[
            {
                "type": "prompt_created",
                "prompt": {
                    "workflow": decision["next_workflow"]["workflow"],
                    "params": decision["next_workflow"]["params"],
                    "key": f"dispatch_workflow:{invocation_id}",
                },
            },
        ],
    )
