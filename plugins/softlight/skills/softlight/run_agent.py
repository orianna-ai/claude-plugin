from __future__ import annotations

import argparse
import concurrent.futures
import json
import time
import traceback
import urllib.request
from typing import TYPE_CHECKING, Any, Literal

from scripts.load_config import Config, load_config
from scripts.post_events import post_events
from scripts.post_transcripts import post_transcripts
from scripts.spawn_reaper import spawn_reaper
from workflows.base import WORKFLOWS

if TYPE_CHECKING:
    from collections.abc import Callable

AgentTask = Literal["dispatch_prompts", "emit_heartbeats", "upload_transcripts"]

_MAX_RETRYABLE_PROMPT_ATTEMPTS = 3
_PROMPT_RETRY_BACKOFF_SECONDS = 5
_RETRYABLE_WORKFLOWS = {
    "generate_decision_plan",
}


def _fetch_events(
    config: Config,
) -> list[dict[str, Any]]:
    try:
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
    except Exception:
        traceback.print_exc()

        return []


def _get_pending_prompts(
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    terminal_prompts = {
        event["prompt_id"]
        for event in events
        if event.get("type") in {"prompt_succeeded", "prompt_failed"}
    }

    pending_prompts = [
        event["prompt"]
        for event in events
        if event.get("type") == "prompt_created"
        if event["prompt"]["metadata"]["id"] not in terminal_prompts
        # HACK: ignore the synthetic generate_mock_revision prompts
        if not event["prompt"]["key"].startswith("generate_mock_revision:")
    ]

    return pending_prompts


def _post_prompt_started(config: Config, prompt: dict[str, Any]) -> None:
    try:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_started",
                    "prompt_id": prompt["metadata"]["id"],
                },
            ],
        )
    except Exception:
        traceback.print_exc()


def _handle_prompt(
    config: Config,
    prompt: dict[str, Any],
) -> None:
    workflow_name = prompt["workflow"]
    max_attempts = _MAX_RETRYABLE_PROMPT_ATTEMPTS if workflow_name in _RETRYABLE_WORKFLOWS else 1

    for attempt in range(1, max_attempts + 1):
        _post_prompt_started(config, prompt)

        try:
            if workflow := WORKFLOWS.get(workflow_name):
                workflow.call(config, prompt.get("params") or {})
            else:
                raise ValueError(f"workflow {workflow_name} does not exist")
        except Exception:
            error = traceback.format_exc()
            traceback.print_exc()

            if attempt < max_attempts:
                time.sleep(_PROMPT_RETRY_BACKOFF_SECONDS * attempt)
                continue

            post_events(
                config=config,
                events=[
                    {
                        "type": "prompt_failed",
                        "prompt_id": prompt["metadata"]["id"],
                        "error": (f"Prompt failed after {attempt} attempt(s).\n\n{error}"),
                    },
                ],
            )
            return

        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_succeeded",
                    "prompt_id": prompt["metadata"]["id"],
                },
            ],
        )
        return


def _dispatch_prompts(
    config: Config,
) -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0

        while True:
            events = _fetch_events(config)

            if len(events) > cursor:
                for prompt in _get_pending_prompts(events[cursor:]):
                    executor.submit(
                        _handle_prompt,
                        config,
                        prompt,
                    )

                cursor = len(events)

            time.sleep(5)


def _emit_heartbeats(
    config: Config,
) -> None:
    while True:
        post_events(
            config=config,
            events=[
                {
                    "type": "heartbeat",
                },
            ],
        )

        time.sleep(30)


def _upload_transcripts(
    config: Config,
) -> None:
    while True:
        time.sleep(10)

        post_transcripts(config)


def _post_agent_task_failed(
    config: Config,
    *,
    error: str,
    restart_count: int,
    task: AgentTask,
) -> None:
    try:
        post_events(
            config=config,
            events=[
                {
                    "type": "agent_task_failed",
                    "task": task,
                    "error": error,
                    "restart_count": restart_count,
                },
            ],
        )
    except Exception:
        traceback.print_exc()


def _run_restartable_task(
    config: Config,
    *,
    task: AgentTask,
    target: Callable[[Config], None],
) -> None:
    """Run a long-lived agent task, restarting it with backoff if it crashes."""
    restart_count = 0

    while True:
        try:
            target(config)
        except Exception:
            error = traceback.format_exc()
            traceback.print_exc()
        else:
            error = "Task exited without raising an exception"

        restart_count += 1
        _post_agent_task_failed(
            config,
            error=error,
            restart_count=restart_count,
            task=task,
        )

        time.sleep(min(60, 2 ** min(restart_count, 6)))


def run_agent(
    *,
    project_id: str,
) -> None:
    config = load_config(project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        executor.submit(
            _run_restartable_task,
            config,
            task="dispatch_prompts",
            target=_dispatch_prompts,
        )
        executor.submit(
            _run_restartable_task,
            config,
            task="emit_heartbeats",
            target=_emit_heartbeats,
        )
        executor.submit(
            _run_restartable_task,
            config,
            task="upload_transcripts",
            target=_upload_transcripts,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    run_agent(
        project_id=args.project_id,
    )


if __name__ == "__main__":
    main()
