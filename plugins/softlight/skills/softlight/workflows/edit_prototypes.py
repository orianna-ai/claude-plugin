from __future__ import annotations

import concurrent.futures
import json
import pathlib
import shutil
import tempfile
import uuid
from typing import TYPE_CHECKING, Any, TypedDict

from scripts.call_claude import call_claude
from scripts.call_mcp import call_mcp
from scripts.get_project import get_project
from scripts.post_events import post_events
from scripts.run_app import run_app

from workflows.base import workflow
from workflows.generate_prototypes import _filtered_canvas_context

if TYPE_CHECKING:
    from scripts.load_config import Config


class EditPrototypesParams(TypedDict):
    mode: str
    brief: str
    feedback: str
    runId: str


class EditPrototypesPlan(TypedDict):
    title: str
    prototype_source_index: int
    spec: str


class EditPrototypesPlanningResult(TypedDict):
    project_id: str
    exploration_title: str
    plans: list[EditPrototypesPlan]


class PrototypeSource(TypedDict):
    index: int
    slot_id: str
    prototype_dir: str


_EDIT_PLANNING_SCHEMA = {
    "type": "object",
    "properties": {
        "project_id": {"type": "string"},
        "exploration_title": {
            "type": "string",
            "description": "Short title for the new row of edited prototypes.",
        },
        "plans": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short label for this edited prototype.",
                    },
                    "prototype_source_index": {
                        "type": "integer",
                        "description": "Index from prototype_sources for the prototype to copy.",
                    },
                    "spec": {
                        "type": "string",
                        "description": "Concrete, small edit plan for this prototype.",
                    },
                },
                "required": ["title", "prototype_source_index", "spec"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["project_id", "exploration_title", "plans"],
    "additionalProperties": False,
}


def _edit_canvas_context(
    project: dict[str, Any],
) -> dict[str, Any]:
    context = _filtered_canvas_context(project)
    return {
        **context,
        "active_decision_id": project.get("active_decision_id"),
        "conversations": project.get("conversations") or [],
        "decisions": project.get("decisions") or [],
        "spec": project.get("spec"),
    }


def _prototype_sources(
    canvas_context: dict[str, Any],
) -> list[PrototypeSource]:
    sources: list[PrototypeSource] = []
    for revision in canvas_context.get("revisions") or []:
        for slot in revision.get("slots") or []:
            element = slot.get("element") or {}
            if element.get("type") != "iframe":
                continue
            source_code_dir = element.get("source_code_dir")
            slot_id = (slot.get("metadata") or {}).get("id")
            if source_code_dir and slot_id:
                sources.append(
                    {
                        "index": len(sources) + 1,
                        "slot_id": str(slot_id),
                        "prototype_dir": str(source_code_dir),
                    },
                )
    return sources


def _find_slot(
    *,
    canvas_context: dict[str, Any],
    slot_id: str,
) -> dict[str, Any] | None:
    for revision in canvas_context.get("revisions") or []:
        for slot in revision.get("slots") or []:
            if str((slot.get("metadata") or {}).get("id")) == slot_id:
                return slot

    return None


def _project_context(
    canvas_context: dict[str, Any],
) -> dict[str, Any]:
    return {
        "active_decision_id": canvas_context.get("active_decision_id"),
        "conversations": canvas_context.get("conversations") or [],
        "decisions": canvas_context.get("decisions") or [],
        "spec": canvas_context.get("spec"),
        "title": canvas_context.get("title"),
    }


def _slot_spec(
    slot: dict[str, Any],
) -> str | None:
    element = slot.get("element") or {}
    spec = element.get("spec")
    return str(spec) if spec else None


def _validate_edit_planning_result(
    *,
    planning_result: dict[str, Any],
    prototype_sources: list[PrototypeSource],
) -> EditPrototypesPlanningResult:
    plans = planning_result.get("plans")
    if not isinstance(plans, list) or len(plans) != 3:
        raise ValueError("edit planning must return exactly three prototype plans")

    exploration_title = str(planning_result.get("exploration_title") or "").strip()
    if not exploration_title:
        raise ValueError("edit planning must return an exploration_title")

    sources_by_index = {source["index"]: source for source in prototype_sources}
    validated_plans: list[EditPrototypesPlan] = []
    for index, plan in enumerate(plans, start=1):
        if not isinstance(plan, dict):
            raise ValueError(f"edit plan {index} must be an object")

        title = str(plan.get("title") or "").strip()
        spec = str(plan.get("spec") or "").strip()
        try:
            prototype_source_index = int(plan.get("prototype_source_index"))
        except (TypeError, ValueError):
            raise ValueError(
                f"edit plan {index} is missing prototype_source_index",
            ) from None

        if not title:
            raise ValueError(f"edit plan {index} is missing a title")
        if not spec:
            raise ValueError(f"edit plan {index} is missing spec")

        source = sources_by_index.get(prototype_source_index)
        if source is None:
            raise ValueError(
                f"edit plan {index} references invalid prototype_source_index "
                f"{prototype_source_index}",
            )
        if not pathlib.Path(source["prototype_dir"]).is_dir():
            raise ValueError(
                f"edit plan {index} prototype_dir does not exist: {source['prototype_dir']}",
            )

        validated_plans.append(
            {
                "title": title,
                "prototype_source_index": prototype_source_index,
                "spec": spec,
            },
        )

    return {
        "project_id": str(planning_result.get("project_id") or ""),
        "exploration_title": exploration_title,
        "plans": validated_plans,
    }


def _plan_edit_prototypes(
    *,
    canvas_context: dict[str, Any],
    config: Config,
    params: EditPrototypesParams,
    feedback: str,
    prototype_sources: list[PrototypeSource],
    run_id: str,
) -> EditPrototypesPlanningResult:
    planning_result = call_claude(
        prompt=[
            """\
Plan a follow-up edit pass for existing prototypes generated to show a solution to a product
problem.

A PM left feedback on designs (the prototypes). They now want revisions based on the feedback.

Your task is to plan the next prototypes to show the PM, given that feedback.

Return exactly three prototype edit plans and a concise title for the new exploration row.
Each plan must mutate an existing prototype that is on the canvas. Choose the prototype to copy by
returning `prototype_source_index` from <prototype_sources>. This plan will be passed to another
teammate who will implement the prototype edit.

<canvas_context> contains:
- conversations: user/agent intake messages and screenshots. Use these to recover what the user
  talked about and what problem the design is solving.
- decisions: product/design decisions already generated or resolved that were brainstormed during
the conversation.
- revisions: canvas rows. Each revision has slots.
- iframe slots: generated prototypes. Use element.spec, screenshots, preview, and nearby text slots
  for intent.
- comment_thread slots: user feedback/comments. Use comments, references, anchors, and screenshots
  of where the comment was placed to infer what needs to change.
- text slots: labels and captions near prototypes.
- pull_requests: implementation PRs already created from selected prototypes.

<prototype_sources> is a compact index of existing iframe prototypes that can be copied. Each entry
contains only `index`, `slot_id`, and `prototype_dir`. Use the `slot_id` to find the detailed slot
in <canvas_context>, but return only `prototype_source_index` in each plan.

Keep the plans small and concrete. If feedback refers to a specific comment/prototype, prefer the
referenced prototype. Otherwise choose the most relevant existing prototypes from the canvas.

<project_id>${project_id}</project_id>
<mode>${mode}</mode>
<brief>${brief}</brief>
<feedback>${feedback}</feedback>
<prototype_sources>${prototype_sources}</prototype_sources>
<canvas_context>${canvas_context}</canvas_context>
""",
        ],
        params={
            "project_id": config.project_id,
            "mode": params["mode"],
            "brief": params["brief"],
            "feedback": feedback,
            "prototype_sources": json.dumps(prototype_sources, indent=2),
            "canvas_context": json.dumps(canvas_context, indent=2),
        },
        config=config,
        effort="low",
        json_schema=_EDIT_PLANNING_SCHEMA,
        model="opus",
        session_id=f"edit_prototypes:plan:{run_id}",
    )

    return _validate_edit_planning_result(
        planning_result=planning_result,
        prototype_sources=prototype_sources,
    )


def _copy_prototype_dir(
    prototype_dir: str,
) -> pathlib.Path:
    source_dir = pathlib.Path(prototype_dir)
    output_dir = pathlib.Path(tempfile.mkdtemp(prefix="edit_prototypes."))
    shutil.copytree(
        source_dir,
        output_dir,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(
            ".git",
            "dist",
            "node_modules",
            "preview.log",
        ),
    )
    return output_dir


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


def _caption_for_plan(
    plan: EditPrototypesPlan,
) -> str:
    first_sentence = plan["spec"].split("\n", 1)[0].strip()
    return f"{plan['title']}: {first_sentence}" if first_sentence else plan["title"]


def _edit_prototype_app(
    *,
    config: Config,
    feedback: str,
    original_slot_spec: str | None,
    project_context: dict[str, Any],
    prototype_dir: pathlib.Path,
    session_id: str,
    spec: str,
) -> None:
    call_claude(
        config=config,
        prompt=[
            """\
You are tasked with editing an existing standalone prototype.

# Input

## `<spec>`

A small concrete plan for this edit pass.

## `<feedback>`

The user's latest comments on an old prototype or requests that drove the spec.

## `<project_context>`

Overall project context: the original user conversation, project spec, and resolved decisions. Use
this to understand the broader product problem and direction.

## `<original_slot_spec>`

The prior design spec for the prototype that was copied into `<prototype_dir>`. Use it to understand
the starting point you are editing.

## `<prototype_dir>`

Absolute path to the copied prototype directory. Write all output here. This directory is a fresh
copy of the existing prototype selected by the planner.

<spec>${spec}</spec>
<feedback>${feedback}</feedback>
<project_context>${project_context}</project_context>
<original_slot_spec>${original_slot_spec}</original_slot_spec>
<prototype_dir>${prototype_dir}</prototype_dir>

# Output

Your goal is to edit the copied standalone prototype in `<prototype_dir>`. Preserve the current
prototype's useful behavior and make only the requested changes. The parent workflow will build,
serve, tunnel, and register the prototype after you return, but you must run `pnpm build` yourself
from `<prototype_dir>` and fix failures until it passes.

# Design and implementation principles

CRITICAL - preserve the existing app and design system:

- The prototype is based off a real application in the codebase. Ensure all the components and
  patterns you use are present in the prototype or the original application. This is essential.
- If you add or substantially change UI, match the existing design system in the prototype or
  the original application.
- If the copied prototype does not contain enough context for a new component, inspect the main app
  source for the relevant component or pattern, then implement the edit so it feels native.

CRITICAL - preserve a full-page prototype:

- Always keep the full page or full workflow state where the requested edit is visible.
- If the requested change is a modal, dropdown, tooltip, panel, toast, or other overlay, render the
  full page with that element visible and anchored in context.
- Keep surrounding navigation, headers, sidebars, breadcrumbs, empty/loading states, avatars,
  counters, and labels that make the page feel like the real app.

CRITICAL - stay client-side and self-contained:

- The prototype must remain a Vite + React client-side app. Do not introduce SSR, hydration, server
  routes, or framework-specific server APIs.
- Remove or replace Node/server-only APIs such as `fs`, `path`, server auth, database clients, ORMs,
  and backend-only configuration.
- Replace backend calls with realistic mock data that supports the edited state.
- Keep relative imports valid. For every relative import you add, make sure the imported file
  exists.
- Do not add a new component library or styling framework.

Editing workflow:

1. Read the copied prototype files in `<prototype_dir>` before editing. You MUST read the files you
   will modify before writing them to avoid "File has not been read yet" errors and to preserve the
   existing implementation.
2. Understand the requested edit from `<spec>`, `<feedback>`, `<project_context>`, and
   `<original_slot_spec>`.
3. Trace the existing prototype's import graph for any file you touch. If you add a relative import,
   make sure the imported file exists and builds.
4. Inspect the main app source when the copied prototype does not already provide the component
   or styling pattern needed to make the edit feel native.
5. Make the coherent code changes in `<prototype_dir>`.
6. Run `pnpm build` from `<prototype_dir>`. Fix errors and rerun until it passes.

""",
        ],
        params={
            "feedback": feedback,
            "original_slot_spec": original_slot_spec or "",
            "project_context": json.dumps(project_context, indent=2),
            "prototype_dir": str(prototype_dir),
            "spec": spec,
        },
        model="opus",
        effort="low",
        session_id=session_id,
    )


def _edit_prototype_for_plan(
    *,
    canvas_context: dict[str, Any],
    caption_slot_id: str | None,
    config: Config,
    feedback: str,
    index: int,
    plan: EditPrototypesPlan,
    prototype_sources: list[PrototypeSource],
    run_id: str,
    slot_id: str,
) -> None:
    source = prototype_sources[plan["prototype_source_index"] - 1]
    source_slot = _find_slot(
        canvas_context=canvas_context,
        slot_id=source["slot_id"],
    )
    if source_slot is None:
        raise ValueError(f"source slot {source['slot_id']} not found")

    new_prototype_dir = _copy_prototype_dir(source["prototype_dir"])
    _edit_prototype_app(
        config=config,
        feedback=feedback,
        original_slot_spec=_slot_spec(source_slot),
        project_context=_project_context(canvas_context),
        prototype_dir=new_prototype_dir,
        session_id=f"edit_prototypes:{run_id}:{index + 1}",
        spec=plan["spec"],
    )

    tunnel_id = str(uuid.uuid4())
    run_app(
        config=config,
        source_code_dir=new_prototype_dir,
        tunnel_id=tunnel_id,
    )

    post_events(
        config=config,
        events=[
            {
                "type": "slot_updated",
                "element": {
                    "type": "iframe",
                    "source_code_dir": str(new_prototype_dir),
                    "screenshots": [],
                    "spec": plan["spec"],
                    "tunnel_id": tunnel_id,
                },
                "slot_id": slot_id,
            },
        ],
    )

    if caption_slot_id:
        _update_text_slot(
            config=config,
            slot_id=caption_slot_id,
            text=_caption_for_plan(plan),
        )


def _run_edit_prototypes(
    *,
    config: Config,
    params: EditPrototypesParams,
    feedback: str,
) -> None:
    run_id = params.get("runId") or str(uuid.uuid4())
    canvas_context = _edit_canvas_context(get_project(config))
    prototype_sources = _prototype_sources(canvas_context)
    if not prototype_sources:
        raise ValueError("edit_prototypes requires at least one existing prototype")

    planning_result = _plan_edit_prototypes(
        canvas_context=canvas_context,
        config=config,
        params=params,
        feedback=feedback,
        prototype_sources=prototype_sources,
        run_id=run_id,
    )

    exploration = call_mcp(
        config=config,
        tool="create_exploration",
        arguments={
            "count": 3,
            "project_id": config.project_id,
            "title": planning_result["exploration_title"],
        },
        timeout=30,
    )
    slot_ids = exploration["slot_ids"]
    caption_slot_ids = exploration.get("caption_slot_ids", [])

    errors: list[BaseException] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {}
        for index, plan in enumerate(planning_result["plans"]):
            slot_id = slot_ids[index]
            caption_slot_id = (
                caption_slot_ids[index] if index < len(caption_slot_ids) else None
            )
            futures[
                executor.submit(
                    _edit_prototype_for_plan,
                    canvas_context=canvas_context,
                    caption_slot_id=caption_slot_id,
                    config=config,
                    feedback=feedback,
                    index=index,
                    plan=plan,
                    prototype_sources=prototype_sources,
                    run_id=run_id,
                    slot_id=slot_id,
                )
            ] = slot_id

        for future in concurrent.futures.as_completed(futures):
            slot_id = futures[future]
            try:
                future.result()
            except BaseException as exception:
                errors.append(exception)
                _post_slot_error(
                    config=config,
                    exception=exception,
                    slot_id=slot_id,
                )

    if errors:
        raise RuntimeError(
            "\n".join(
                [
                    f"{len(errors)} of {len(slot_ids)} edit_prototypes agents failed:",
                    *(f"  {error!r}" for error in errors),
                ],
            ),
        )


@workflow()
def edit_prototypes(
    config: Config,
    params: EditPrototypesParams,
) -> None:
    """Edit existing prototypes from PM comments or feedback."""
    feedback = params["feedback"].strip()
    if not feedback:
        raise ValueError("edit_prototypes requires feedback")

    _run_edit_prototypes(
        config=config,
        params=params,
        feedback=feedback,
    )
