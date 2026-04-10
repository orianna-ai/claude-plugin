import concurrent.futures
import json
import os
import tempfile
from typing import Any

from scripts.call_claude import call_claude
from scripts.call_mcp import call_mcp
from scripts.load_config import load_config
from scripts.upload_file import upload_file

_RUN_DESIGNER_SESSION_ID = "run-designer"


def _generate_prototype(
    *,
    slot_id: str,
    spec: str,
) -> None:
    config = load_config()
    assert config.project_id is not None
    assert config.app_workspace is not None

    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "content_script.js")

        call_claude(
            prompt=f"""\
/generate-content-script
<path>{path}</path>
<project_id>{config.project_id}</project_id>
<slot_id>{slot_id}</slot_id>
<spec>{spec}</spec>
<workspace>{config.app_workspace}</workspace>
""",
            effort="max",
            model="opus",
            parent_session_id=_RUN_DESIGNER_SESSION_ID,
            timeout=600,
        )

        content_script_url = upload_file(path)

    call_mcp(
        tool="update_iframe_element",
        input={
            "content_script_url": content_script_url,
            "project_id": config.project_id,
            "slot_id": slot_id,
            "spec": spec,
        },
    )


def _present_canvas(
    *,
    explorations: list[dict[str, Any]],
) -> None:
    config = load_config()
    assert config.project_id is not None

    call_claude(
        prompt=f"""\
/present-canvas
<explorations_created>{json.dumps(explorations)}</explorations_created>
<project_id>{config.project_id}</project_id>
""",
        effort="max",
        model="opus",
        parent_session_id=_RUN_DESIGNER_SESSION_ID,
        timeout=600,
    )


def generate_revision() -> None:
    config = load_config()
    assert config.project_id is not None
    assert config.app_workspace is not None
    assert config.problem is not None

    run_designer_output = call_claude(
        prompt=f"""\
/run-designer
<workspace>{config.app_workspace}</workspace>
<problem>{config.problem}</problem>
<project_id>{config.project_id}</project_id>
""",
        json_schema={
            "type": "object",
            "properties": {
                "explorations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "prototypes": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "slot_id": {
                                            "type": "string",
                                        },
                                        "spec": {
                                            "type": "string",
                                        },
                                    },
                                    "required": ["slot_id", "spec"],
                                },
                            },
                            "caption_slot_ids": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                },
                            },
                            "title_slot_id": {
                                "type": "string",
                            },
                        },
                        "required": ["prototypes", "caption_slot_ids", "title_slot_id"],
                    },
                },
            },
            "required": ["explorations"],
        },
        effort="max",
        model="opus",
        session_id=_RUN_DESIGNER_SESSION_ID,
        timeout=600,
    )

    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
        futures = []

        for exploration in run_designer_output["explorations"]:
            for prototype in exploration["prototypes"]:
                futures.append(
                    executor.submit(
                        _generate_prototype,
                        slot_id=prototype["slot_id"],
                        spec=prototype["spec"],
                    ),
                )

        futures.append(
            executor.submit(
                _present_canvas,
                explorations=run_designer_output["explorations"],
            ),
        )

        errors = []

        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as e:
                errors.append(e)

        if errors:
            raise RuntimeError("\n".join(str(error) for error in errors))


def main() -> None:
    generate_revision()


if __name__ == "__main__":
    main()
