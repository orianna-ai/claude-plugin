import concurrent.futures
import contextlib
import json
import sys
import time
import urllib.request
import uuid
from typing import Any

from scripts.call_claude import call_claude
from scripts.load_config import Config, load_config
from scripts.post_events import post_events
from scripts.post_transcripts import post_transcripts


def _handle_prompt(
    config: Config,
    prompt: dict[str, Any],
) -> None:
    try:
        call_claude(
            config=config,
            prompt=f"""\
You are an agent working on Softlight project {config.project_id}. You are running in a
non-interactive environment. Do not ask the user questions - they have no way to answer.

{prompt["text"]}
""",
            effort=prompt.get("effort"),
            model=prompt.get("model"),
            session_id=f"{config.project_id}:{prompt['key']}",
        )
    except Exception:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_completed",
                    "prompt_id": prompt["metadata"]["id"],
                    "status": "failure",
                },
            ],
        )
    else:
        post_events(
            config=config,
            events=[
                {
                    "type": "prompt_completed",
                    "prompt_id": prompt["metadata"]["id"],
                    "status": "success",
                },
            ],
        )


def _create_project(config: Config, problem_statement: str) -> str:
    """Create the Softlight project and return its URL."""
    post_events(
        config=config,
        events=[
            {
                "type": "project_updated",
                "problem": {
                    "text": problem_statement,
                    "baseline": {
                        "type": "iframe",
                        "content_script": None,
                        "tunnel_id": "",
                    },
                    "attachments": [],
                },
            },
        ],
    )

    return f"{config.base_url}/projects/{config.project_id}"


def dispatch_prompts() -> None:
    problem_statement = sys.argv[1] if len(sys.argv) > 1 else ""

    config = load_config(
        project_id=str(uuid.uuid4()),
    )

    project_url = _create_project(config, problem_statement)
    print(f"PROJECT_URL={project_url}", flush=True)

    post_events(
        config=config,
        events=[
            {
                "type": "prompt_created",
                "prompt": {
                    "text": """\
Invoke the `run-designer-codegen` skill to create the project and generate the initial explorations.
Do not stop until you have generated every prototype in every exploration that you create in the
project.
""",
                    "key": "generate_prototypes",
                    "effort": "max",
                    "model": "opus",
                },
            },
        ],
    )

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        cursor = 0

        while True:
            with urllib.request.urlopen(
                urllib.request.Request(
                    f"{config.base_url}/api/projects/{config.project_id}/events",
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "claude-code",
                    },
                ),
            ) as response:
                events = json.loads(response.read())

            for event in events[cursor:]:
                if event.get("type") == "prompt_created":
                    executor.submit(
                        _handle_prompt,
                        config,
                        event["prompt"],
                    )

            cursor = len(events)

            time.sleep(10)

            with contextlib.suppress(Exception):
                post_transcripts(config)


def main() -> None:
    dispatch_prompts()


if __name__ == "__main__":
    main()
