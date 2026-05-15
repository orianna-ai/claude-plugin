from __future__ import annotations

import concurrent.futures
import json
import uuid
from typing import TYPE_CHECKING, Any, TypedDict

from scripts.call_claude import call_claude
from scripts.call_mcp import call_mcp
from scripts.create_app import create_app
from scripts.get_project import get_project
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow
from workflows.generate_initial_prototype import generate_initial_prototype_app

if TYPE_CHECKING:
    from scripts.load_config import Config


class GenerateInitialPrototypesParams(TypedDict, total=False):
    brief: str
    runId: str


class InitialPrototypeApproach(TypedDict):
    caption: str
    title: str
    description: str


_APPROACH_SCHEMA = {
    "type": "object",
    "properties": {
        "approaches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short label for this prototype approach.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Concise design direction for this approach.",
                    },
                    "caption": {
                        "type": "string",
                        "description": "Human-readable canvas caption for this prototype. Keep it snappy, short, to the point, and easy to read quickly.",
                    },
                },
                "required": ["title", "description", "caption"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["approaches"],
    "additionalProperties": False,
}


def _conversations_for_prd(
    *,
    brief: str,
    conversations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if any(conversation.get("messages") for conversation in conversations):
        return conversations
    if not brief:
        return conversations
    return [
        {
            "room": "exported-transcript",
            "messages": [
                {
                    "role": "user",
                    "text": brief,
                    "timestamp": 0.0,
                },
            ],
            "screenshots": [],
        },
    ]


def _generate_approaches(
    *,
    config: Config,
    conversations: list[dict[str, Any]],
    run_id: str,
) -> list[InitialPrototypeApproach | None]:
    from workflows.generate_prd import transcript_conversations

    try:
        result = call_claude(
            config=config,
            prompt=[
                """\
Generate exactly three approaches/themes for an initial Softlight design exploration.

Approach 1 should be the most straightforward way a strong designer would solve the problem.
Approaches 2 and 3 should be the next things a strong designer would try to test the biggest
risks in approach 1.

Keep each approach short and directional. Do not write PRDs.

For `caption`, write the exact text that appears below the prototype on the canvas. It should be
human-readable, very concise, snappy, short, to the point, and easy to read quickly.

Return structured output matching the provided JSON schema.

<conversations>${conversations}</conversations>
""",
            ],
            params={
                "conversations": json.dumps(
                    transcript_conversations(conversations),
                    indent=2,
                ),
            },
            json_schema=_APPROACH_SCHEMA,
            fork_session=False,
            model="opus",
            effort="low",
            session_id=f"generate_initial_prototype_approaches:{run_id}",
        )
    except Exception:
        return [None, None, None]

    approaches = [
        approach
        for approach in result.get("approaches", [])
        if approach.get("title", "").strip() or approach.get("description", "").strip()
    ]

    return [*approaches[:3], None, None, None][:3]


def _format_approach(
    approach: InitialPrototypeApproach | None,
) -> str | None:
    if not approach:
        return None

    title = approach.get("title", "").strip()
    description = approach.get("description", "").strip()

    return "\n\n".join(part for part in [title, description] if part) or None


def _description_for_prototype(
    *,
    approach: InitialPrototypeApproach | None,
    spec: str,
) -> str:
    if approach:
        caption = approach.get("caption", "").strip()
        description = approach.get("description", "").strip()
        title = approach.get("title", "").strip()
        if caption:
            return caption
        if title and description:
            return f"{title}: {description}"
        if description:
            return description
        if title:
            return title

    for line in spec.splitlines():
        line = line.strip().lstrip("#").strip()
        if line:
            return line

    return "Initial prototype"


def _post_slot_error(
    *,
    config: Config,
    exception: BaseException,
    slot_id: str,
) -> None:
    post_events(
        config=config,
        events=[
            {
                "type": "slot_updated",
                "element": {
                    "type": "error",
                    "message": str(exception),
                },
                "slot_id": slot_id,
            },
        ],
    )


def _update_text_slot(
    *,
    config: Config,
    slot_id: str,
    text: str,
) -> None:
    try:
        call_mcp(
            config=config,
            tool="update_text_element",
            arguments={
                "project_id": config.project_id,
                "slot_id": slot_id,
                "text": text,
            },
            timeout=30,
        )
    except Exception:
        post_events(
            config=config,
            events=[
                {
                    "type": "slot_updated",
                    "element": {
                        "type": "text",
                        "text": text,
                    },
                    "slot_id": slot_id,
                },
            ],
        )


@workflow()
def generate_initial_prototypes(
    config: Config,
    params: GenerateInitialPrototypesParams,
) -> None:
    """Generate three PRD-backed initial prototypes in the project."""
    run_id = params.get("runId") or str(uuid.uuid4())
    brief = params.get("brief", "").strip()

    exploration = call_mcp(
        config=config,
        tool="create_exploration",
        arguments={
            "count": 3,
            "project_id": config.project_id,
            "title": "Initial prototypes",
        },
        timeout=30,
    )
    slot_ids = exploration["slot_ids"]
    caption_slot_ids = exploration.get("caption_slot_ids", [])

    project = get_project(config=config)
    conversations = _conversations_for_prd(
        brief=brief,
        conversations=project.get("conversations", []),
    )
    approaches = _generate_approaches(
        config=config,
        conversations=conversations,
        run_id=run_id,
    )

    def generate_prd_for_slot(index: int) -> dict[str, Any]:
        from workflows.generate_prd import generate_prd_spec

        approach = approaches[index] if index < len(approaches) else None
        spec = generate_prd_spec(
            approach=_format_approach(approach),
            config=config,
            conversations=conversations,
            session_id=f"generate_prd:{run_id}:{index + 1}",
        )

        return {
            "approach": approach,
            "caption_slot_id": (
                caption_slot_ids[index] if index < len(caption_slot_ids) else None
            ),
            "index": index,
            "slot_id": slot_ids[index],
            "spec": spec,
        }

    def generate_prototype_for_slot(job: dict[str, Any]) -> dict[str, Any]:
        prototype_dir = create_app()
        generate_initial_prototype_app(
            config=config,
            conversations=conversations,
            prototype_dir=prototype_dir,
            session_id=f"generate_initial_prototype:{run_id}:{job['index'] + 1}",
            spec=job["spec"],
        )

        tunnel_id = str(uuid.uuid4())

        run_app(
            config=config,
            source_code_dir=prototype_dir,
            tunnel_id=tunnel_id,
        )

        description = _description_for_prototype(
            approach=job["approach"],
            spec=job["spec"],
        )
        call_mcp(
            config=config,
            tool="update_iframe_element",
            arguments={
                "project_id": config.project_id,
                "screenshot_urls": [],
                "slot_id": job["slot_id"],
                "source_code_dir": str(prototype_dir),
                "spec": job["spec"],
                "tunnel_id": tunnel_id,
            },
            timeout=25,
        )
        if job["caption_slot_id"]:
            _update_text_slot(
                config=config,
                slot_id=job["caption_slot_id"],
                text=description,
            )

        return job

    errors: list[BaseException] = []
    completed_jobs: list[dict[str, Any]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        prd_futures = {
            executor.submit(generate_prd_for_slot, index): index
            for index in range(len(slot_ids))
        }
        prototype_futures: dict[concurrent.futures.Future, dict[str, Any]] = {}

        for future in concurrent.futures.as_completed(prd_futures):
            index = prd_futures[future]
            slot_id = slot_ids[index]
            try:
                job = future.result()
            except BaseException as exception:
                errors.append(exception)
                _post_slot_error(
                    config=config,
                    exception=exception,
                    slot_id=slot_id,
                )
                continue

            completed_jobs.append(job)
            prototype_futures[executor.submit(generate_prototype_for_slot, job)] = job

        for future in concurrent.futures.as_completed(prototype_futures):
            job = prototype_futures[future]
            try:
                future.result()
            except BaseException as exception:
                errors.append(exception)
                _post_slot_error(
                    config=config,
                    exception=exception,
                    slot_id=job["slot_id"],
                )

    if completed_jobs:
        completed_jobs.sort(key=lambda job: job["index"])
        combined_spec = "\n\n".join(
            f"## Prototype {job['index'] + 1}\n\n{job['spec']}"
            for job in completed_jobs
        )
        post_events(
            config=config,
            events=[
                {
                    "type": "project_updated",
                    "spec": combined_spec,
                },
            ],
        )

    if errors:
        raise RuntimeError(
            "\n".join(
                [
                    f"{len(errors)} of {len(slot_ids)} initial prototype agents failed:",
                    *(f"  {error!r}" for error in errors),
                ],
            ),
        )
