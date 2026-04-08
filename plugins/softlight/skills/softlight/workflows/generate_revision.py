import concurrent.futures
import os
import tempfile

from scripts.call_claude import call_claude
from scripts.call_mcp import call_mcp
from scripts.load_config import load_config
from scripts.upload_file import upload_file


def _generate_prototype(
    *,
    project_id: str,
    slot_id: str,
    spec: str,
) -> None:
    print(f"generating content script for slot {slot_id}")

    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "content_script.js")

        call_claude(
            prompt=f"""\
/generate-content-script
<path>{path}</path>
<spec>{spec}</spec>
""",
            model="opus",
            timeout=1800,
        )

        content_script_url = upload_file(path)

        call_mcp(
            tool="update_iframe_element",
            input={
                "content_script_url": content_script_url,
                "project_id": project_id,
                "slot_id": slot_id,
                "spec": spec,
            },
        )

    print(f"generated content script for slot {slot_id}")


def _generate_caption(
    *,
    project_id: str,
    slot_id: str,
    spec: str,
) -> None:
    print(f"generating caption for slot {slot_id}")

    generate_caption_output = call_claude(
        prompt=f"""\
/generate-caption
<spec>{spec}</spec>
""",
        allowed_tools=[],
        json_schema={
            "type": "object",
            "properties": {
                "caption": {
                    "type": "string",
                },
            },
            "required": ["caption"],
        },
        model="sonnet",
        tools=[],
    )

    call_mcp(
        tool="update_text_element",
        input={
            "project_id": project_id,
            "slot_id": slot_id,
            "text": generate_caption_output["caption"],
        },
    )

    print(f"generated caption for slot {slot_id}")


def generate_revision() -> None:
    with load_config() as config:
        assert config.project_id is not None

        generate_specs_output = call_claude(
            prompt=f"""\
/generate-specs
<project_id>{config.project_id}</project_id>
<problem_statement>{config.problem_statement}</problem_statement>
""",
            json_schema={
                "type": "object",
                "properties": {
                    "specs": {
                        "type": "array",
                        "items": {
                            "type": "string",
                        },
                    },
                },
                "required": ["specs"],
            },
            model="opus",
            timeout=600,
        )

        create_revision_output = call_mcp(
            tool="create_revision",
            input={
                "project_id": config.project_id,
                "prototype_count": str(len(generate_specs_output["specs"])),
            },
            timeout=300,
            json_schema={
                "type": "object",
                "properties": {
                    "placeholders": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "prototype_slot_id": {
                                    "type": "string",
                                },
                                "caption_slot_id": {
                                    "type": "string",
                                },
                            },
                            "required": ["prototype_slot_id", "caption_slot_id"],
                        },
                    },
                },
                "required": ["placeholders"],
            },
        )

        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
            futures = []

            for spec, placeholder in zip(
                generate_specs_output["specs"],
                create_revision_output["placeholders"],
            ):
                futures.append(
                    executor.submit(
                        _generate_prototype,
                        project_id=config.project_id,
                        slot_id=placeholder["prototype_slot_id"],
                        spec=spec,
                    ),
                )

                futures.append(
                    executor.submit(
                        _generate_caption,
                        project_id=config.project_id,
                        slot_id=placeholder["caption_slot_id"],
                        spec=spec,
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
