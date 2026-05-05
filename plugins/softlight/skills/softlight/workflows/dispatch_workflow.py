from __future__ import annotations

import datetime
import json
import uuid
from typing import TYPE_CHECKING, Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config  # noqa: TC002
from scripts.post_events import post_events

from workflows.base import Workflow, workflow
from workflows.clone_app import clone_app
from workflows.do_nothing import do_nothing
from workflows.explore_codebase import explore_codebase
from workflows.generate_mocks import generate_mocks

if TYPE_CHECKING:
    from collections.abc import Iterator

_GENERATE_MOCK_REVISION_KEY_PREFIX = "generate_mock_revision:"


class DispatchWorkflowParams(TypedDict):
    pass


def _get_workflow_status(
    project: dict[str, Any],
    workflow: Workflow,
) -> str | None:
    for prompt in reversed(project.get("prompts") or []):
        if str(prompt.get("key") or "").startswith(_GENERATE_MOCK_REVISION_KEY_PREFIX):
            continue

        if prompt.get("workflow") == workflow.name:
            return prompt.get("status")

    return None


def _created_at(
    value: dict[str, Any],
) -> datetime.datetime:
    if created_at := value.get("metadata", {}).get("created_at"):
        return datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)


def _proposed_awaiting_feedback_decision_ids(
    project: dict[str, Any],
) -> set[str]:
    discussion = project.get("discussion") or {}
    discussion_created_at = _created_at(discussion)

    awaiting_feedback_decision_ids: set[str] = set()
    for proposed_discussion in project.get("proposed_discussions") or []:
        if _created_at(proposed_discussion) <= discussion_created_at:
            continue

        for decision in proposed_discussion.get("decisions") or []:
            decision_id = str(decision.get("id") or "")
            if decision_id and decision.get("status") == "awaiting_feedback":
                awaiting_feedback_decision_ids.add(decision_id)

    return awaiting_feedback_decision_ids


def _should_generate_mocks(
    project: dict[str, Any],
) -> bool:
    if _get_workflow_status(project, generate_mocks) == "pending":
        return False

    discussion = project.get("discussion") or {}
    decisions = discussion.get("decisions") or []
    awaiting_feedback_decision_ids = _proposed_awaiting_feedback_decision_ids(project)

    return any(
        decision.get("status") == "sketching"
        for decision in decisions
        if decision.get("status") not in {"resolved", "deferred"}
        and str(decision.get("id") or "") not in awaiting_feedback_decision_ids
    )


def _candidate_workflows(
    project: dict[str, Any],
) -> Iterator[Workflow]:
    if _should_generate_mocks(project):
        yield generate_mocks

    if _get_workflow_status(project, clone_app) not in {"pending", "success"}:
        yield clone_app

    if _get_workflow_status(project, explore_codebase) not in {"pending", "success"}:
        yield explore_codebase


@workflow
def dispatch_workflow(
    config: Config,
    params: DispatchWorkflowParams,
) -> None:
    """Pick the next workflow to run based on the project's current state."""
    project = get_project(config)

    candidate_workflows = list(_candidate_workflows(project))

    if not candidate_workflows:
        return

    candidate_workflows.append(do_nothing)

    session_id = f"dispatch_workflow:{uuid.uuid4()}"

    decision = call_claude(
        prompt=[
            """\
Pick the workflow that best matches the project's current state and provide its parameters.

The project may have multiple `conversations` — each is a separate LiveKit session. Look across
all of them when deciding what to do next.

<candidate_workflows>
${candidate_workflows}
</candidate_workflows>

<project>
${project}
</project>
""",
        ],
        params={
            "candidate_workflows": "\n".join(
                f"- {candidate_workflow.name}: {candidate_workflow.description}"
                for candidate_workflow in candidate_workflows
            ),
            "project": json.dumps(
                project,
                indent=2,
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
        session_id=session_id,
    )

    if decision["next_workflow"]["workflow"] != do_nothing.name:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_created",
                    "prompt": {
                        "workflow": decision["next_workflow"]["workflow"],
                        "params": decision["next_workflow"]["params"],
                        "key": session_id,
                    },
                },
            ],
        )
