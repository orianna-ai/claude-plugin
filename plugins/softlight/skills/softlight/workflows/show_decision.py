from __future__ import annotations

import html
import math
import time
import uuid
from typing import TYPE_CHECKING, Any, TypedDict

from scripts.get_project import get_project
from scripts.post_events import post_events

from workflows.base import workflow

if TYPE_CHECKING:
    from scripts.load_config import Config

_SKETCH_WIDTH = 1720
_SKETCH_HEIGHT = 1120
_SKETCH_GAP = 120
_TITLE_HEIGHT = 120.0
_CAPTION_HEIGHT = 120.0
_ROW_GAP = 64.0
_REVISION_GAP = 800.0
_GRID_SIZE = 40.0
_SKETCH_READY_POLL_SECONDS = 3.0
_SKETCH_READY_TIMEOUT_SECONDS = 20 * 60


class ShowDecisionParams(TypedDict, total=False):
    decisionId: str
    runId: str


def _canvas_bottom(project: dict[str, Any]) -> float:
    bottom = 0.0
    for revision in project.get("revisions") or []:
        for slot in revision.get("slots") or []:
            x = float(slot.get("x") or 0)
            y = float(slot.get("y") or 0)
            if x < -90000 or y < -90000:
                continue
            bottom = max(bottom, y + float(slot.get("height") or 0))
    if bottom == 0:
        return 0.0
    return math.ceil((bottom + _REVISION_GAP) / _GRID_SIZE) * _GRID_SIZE


def _find_decision(
    project: dict[str, Any],
    decision_id: str,
) -> dict[str, Any] | None:
    for decision in project.get("decisions") or []:
        if str(decision.get("id") or "") == decision_id:
            return decision
    return None


def _wrap_sketch_html(body: str, title: str) -> str:
    if "<html" in body.lower():
        return body
    return f"""\
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(title)}</title>
  </head>
  <body>
{body}
  </body>
</html>
"""


def _wait_for_sketches(
    *,
    config: Config,
    decision_id: str,
) -> dict[str, Any]:
    deadline = time.monotonic() + _SKETCH_READY_TIMEOUT_SECONDS
    while True:
        project = get_project(config=config)
        decision = _find_decision(project, decision_id)
        if decision is None:
            raise ValueError(f"No decision found for decisionId={decision_id!r}")
        if decision.get("sketches_ready") and decision.get("sketches"):
            return decision
        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"Sketches for decisionId={decision_id!r} did not arrive within "
                f"{_SKETCH_READY_TIMEOUT_SECONDS}s",
            )
        time.sleep(_SKETCH_READY_POLL_SECONDS)


@workflow
def show_decision(
    config: Config,
    params: ShowDecisionParams,
) -> None:
    """Lay out the sketches for one decision on the canvas, waiting if needed."""
    decision_id = str(params.get("decisionId") or "")
    if not decision_id:
        raise ValueError("show_decision requires a decisionId")
    run_id = params.get("runId") or str(uuid.uuid4())

    project = get_project(config=config)
    decision = _find_decision(project, decision_id)
    if decision is None:
        raise ValueError(f"No decision found for decisionId={decision_id!r}")

    sketch_count = max(len(decision.get("tradeoffs") or []), 3)
    row_width = sketch_count * _SKETCH_WIDTH + (sketch_count - 1) * _SKETCH_GAP

    base_y = _canvas_bottom(project)
    title_slot_id = str(uuid.uuid4())
    sketch_slot_ids = [str(uuid.uuid4()) for _ in range(sketch_count)]
    caption_slot_ids = [str(uuid.uuid4()) for _ in range(sketch_count)]

    post_events(
        config=config,
        events=[
            {"type": "revision_created", "revision": {}},
            {
                "type": "slot_created",
                "slot": {
                    "metadata": {"id": title_slot_id},
                    "element": {
                        "type": "text",
                        "variant": "h2",
                        "bold": True,
                        "text": decision["open_question"],
                    },
                    "width": row_width,
                    "height": _TITLE_HEIGHT,
                    "x": 0,
                    "y": base_y,
                },
            },
            *[
                {
                    "type": "slot_created",
                    "slot": {
                        "metadata": {"id": sketch_slot_id},
                        "element": {
                            "type": "placeholder",
                            "content_type": "prototype",
                        },
                        "width": _SKETCH_WIDTH,
                        "height": _SKETCH_HEIGHT,
                        "x": index * (_SKETCH_WIDTH + _SKETCH_GAP),
                        "y": base_y + _TITLE_HEIGHT + _ROW_GAP,
                    },
                }
                for index, sketch_slot_id in enumerate(sketch_slot_ids)
            ],
            *[
                {
                    "type": "slot_created",
                    "slot": {
                        "metadata": {"id": caption_slot_id},
                        "references": [
                            {"type": "slot", "slot_id": sketch_slot_ids[index]},
                        ],
                        "element": {
                            "type": "placeholder",
                            "content_type": "text",
                        },
                        "width": _SKETCH_WIDTH,
                        "height": _CAPTION_HEIGHT,
                        "x": index * (_SKETCH_WIDTH + _SKETCH_GAP),
                        "y": base_y + _TITLE_HEIGHT + _ROW_GAP + _SKETCH_HEIGHT + _ROW_GAP,
                    },
                }
                for index, caption_slot_id in enumerate(caption_slot_ids)
            ],
            {
                "type": "prompt_progress",
                "prompt_id": run_id,
                "result": {
                    "decision_id": decision_id,
                    "title_slot_id": title_slot_id,
                    "sketch_slot_ids": sketch_slot_ids,
                    "caption_slot_ids": caption_slot_ids,
                },
            },
        ],
    )

    ready_decision = _wait_for_sketches(config=config, decision_id=decision_id)
    sketches = list(ready_decision.get("sketches") or [])

    slot_updates: list[dict[str, Any]] = []
    for index in range(sketch_count):
        if index >= len(sketches):
            break
        sketch = sketches[index]
        slot_updates.append(
            {
                "type": "slot_updated",
                "slot_id": sketch_slot_ids[index],
                "element": {
                    "type": "html",
                    "html": _wrap_sketch_html(
                        str(sketch.get("html") or ""),
                        str(sketch.get("title") or ""),
                    ),
                },
            },
        )
        slot_updates.append(
            {
                "type": "slot_updated",
                "slot_id": caption_slot_ids[index],
                "element": {
                    "type": "text",
                    "variant": "p",
                    "bold": False,
                    "text": f"**{sketch.get('title') or ''}**\n\n{sketch.get('caption') or ''}",
                },
            },
        )

    if slot_updates:
        post_events(config=config, events=slot_updates)

    post_events(
        config=config,
        events=[
            {
                "type": "prompt_progress",
                "prompt_id": run_id,
                "result": {
                    "decision_id": decision_id,
                    "title_slot_id": title_slot_id,
                    "sketch_slot_ids": sketch_slot_ids,
                    "caption_slot_ids": caption_slot_ids,
                    "sketches_ready": True,
                    "follow_up_questions": list(
                        ready_decision.get("follow_up_questions") or [],
                    ),
                },
            },
        ],
    )
