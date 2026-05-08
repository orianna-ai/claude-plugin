import concurrent.futures
import json
import time
import urllib.request
from typing import Any, TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow

_CLONE_APP_POLL_SECONDS = 5
_CLONE_APP_TIMEOUT_SECONDS = 20 * 60
_CLONE_APP_PROMPT_KEY = "clone_app"


def _is_filtered_canvas_slot(
    slot: dict[str, Any],
) -> bool:
    element = slot.get("element") or {}
    element_type = element.get("type")

    if element_type == "image":
        return True

    return element_type == "placeholder" and element.get("content_type") == "mock"


def _filtered_canvas_context(
    project: dict[str, Any],
) -> dict[str, Any]:
    revisions = []
    for revision in project.get("revisions") or []:
        slots = [slot for slot in revision.get("slots") or [] if not _is_filtered_canvas_slot(slot)]
        revisions.append({**revision, "slots": slots})

    return {
        "metadata": project.get("metadata"),
        "title": project.get("title"),
        "baseline": project.get("baseline"),
        "revisions": revisions,
        "pull_requests": project.get("pull_requests") or [],
    }


def _baseline_dir(
    project: dict[str, Any],
) -> str:
    return (((project.get("baseline") or {}).get("source_code_dir")) or "").strip()


def _clone_app_prompts(
    project: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        prompt for prompt in project.get("prompts") or [] if prompt.get("workflow") == "clone_app"
    ]


def _fetch_events(
    config: Config,
) -> list[dict[str, Any]]:
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{config.base_url}/api/projects/{config.project_id}/events",
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code",
            },
        ),
        timeout=10,
    ) as response:
        return json.loads(response.read())


def _clone_app_kickoff_event_exists(
    config: Config,
) -> bool:
    try:
        events = _fetch_events(config)
    except Exception:
        return False

    return any(
        event.get("type") == "prompt_created"
        and (event.get("prompt") or {}).get("workflow") == "clone_app"
        for event in events
    )


def _ensure_clone_app(
    config: Config,
) -> tuple[dict[str, Any], str]:
    project = get_project(config)
    if baseline_dir := _baseline_dir(project):
        return project, baseline_dir

    clone_prompts = _clone_app_prompts(project)
    if not clone_prompts and not _clone_app_kickoff_event_exists(config):
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_created",
                    "prompt": {
                        "workflow": "clone_app",
                        "params": {},
                        "key": _CLONE_APP_PROMPT_KEY,
                    },
                },
            ],
        )

    deadline = time.monotonic() + _CLONE_APP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        time.sleep(_CLONE_APP_POLL_SECONDS)
        project = get_project(config)
        if baseline_dir := _baseline_dir(project):
            return project, baseline_dir

        clone_prompts = _clone_app_prompts(project)
        if clone_prompts and not any(prompt.get("status") == "pending" for prompt in clone_prompts):
            raise RuntimeError(
                "clone_app finished without creating a project baseline; "
                "not rerunning because clone_app is limited to one call per project.",
            )

    raise TimeoutError("timed out waiting for clone_app to create the project baseline")


class GeneratePrototypesParams(TypedDict):
    mode: str
    brief: str
    feedback: str


@workflow
def generate_prototypes(
    config: Config,
    params: GeneratePrototypesParams,
) -> None:
    """Generate design prototype variants in the project from a brief or PM feedback."""
    project, baseline_dir = _ensure_clone_app(config)
    canvas_context = _filtered_canvas_context(project)
    feedback = params["feedback"].strip()
    feedback_section = (
        ""
        if not feedback
        else f"""\
The PM reviewed the canvas and left feedback. Use the `run-designer-codegen` skill to create new
revisions that address their feedback. The app clone and project have already been created — you do
not need to do that again. Do not stop until you have generated every prototype in every
exploration.

<feedback>
{feedback}
</feedback>

"""
    )

    handoff = call_claude(
        prompt=[
            """\
${feedback_section}\
Use the `run-designer-codegen` skill to generate explorations in the project.

<mode>${mode}</mode>
<baseline_dir>${baseline_dir}</baseline_dir>
<transcript>${transcript}</transcript>
<canvas_context>${canvas_context}</canvas_context>
""",
        ],
        params={
            "feedback_section": feedback_section,
            "mode": params["mode"],
            "baseline_dir": baseline_dir,
            "transcript": params["brief"],
            "canvas_context": json.dumps(canvas_context, indent=2),
        },
        config=config,
        effort="low",
        json_schema={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "baseline_dir": {"type": "string"},
                "prototypes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "slot_id": {"type": "string"},
                            "caption_slot_id": {"type": "string"},
                            "spec": {"type": "string"},
                            "images": {"type": "array", "items": {"type": "string"}},
                            "context": {"type": "string"},
                            "prototype_dir": {"type": "string"},
                        },
                        "required": ["slot_id", "spec", "images", "context"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["project_id", "baseline_dir", "prototypes"],
            "additionalProperties": False,
        },
        model="opus",
        session_id="run_designer_codegen",
    )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=len(handoff["prototypes"]),
    ) as executor:
        futures = []

        for prototype in handoff["prototypes"]:
            futures.append(
                executor.submit(
                    call_claude,
                    prompt=[
                        """\
Dispatch the `generate-prototype` skill with these inputs.

<project_id>${project_id}</project_id>
<slot_id>${slot_id}</slot_id>
<caption_slot_id>${caption_slot_id}</caption_slot_id>
<baseline_dir>${baseline_dir}</baseline_dir>
<spec>${spec}</spec>
<images>${images}</images>
<context>${context}</context>
<prototype_dir>${prototype_dir}</prototype_dir>
""",
                    ],
                    params={
                        "project_id": handoff["project_id"],
                        "slot_id": prototype["slot_id"],
                        "caption_slot_id": prototype.get("caption_slot_id", ""),
                        "baseline_dir": handoff["baseline_dir"],
                        "spec": prototype["spec"],
                        "images": "\n".join(prototype["images"]),
                        "context": prototype["context"],
                        "prototype_dir": prototype.get("prototype_dir", ""),
                    },
                    config=config,
                    effort="xhigh",
                    model="opus",
                    session_id=f"generate_prototype:{prototype['slot_id']}",
                ),
            )

        errors: list[BaseException] = []

        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except BaseException as exception:
                errors.append(exception)

        if errors:
            raise RuntimeError(
                "\n".join(
                    [
                        f"{len(errors)} of {len(futures)} agents failed:",
                        *(f"  {e!r}" for e in errors),
                    ],
                ),
            )
