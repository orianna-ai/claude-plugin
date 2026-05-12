import json
import pathlib
from typing import Any

from scripts.call_claude import call_claude
from scripts.load_config import Config


def generate_initial_prototype_app(
    *,
    config: Config,
    conversations: list[dict[str, Any]],
    prototype_dir: pathlib.Path,
    session_id: str,
    spec: str,
) -> None:
    design_context = (
        f"<spec>{spec}</spec>"
        if spec
        else (f"<conversations>{json.dumps(conversations, indent=2)}</conversations>")
    )

    call_claude(
        config=config,
        prompt=[
            """\
Call the `generate-initial-prototype` skill.

${design_context}
<prototype_dir>${prototype_dir}</prototype_dir>
""",
        ],
        params={
            "prototype_dir": str(prototype_dir),
            "design_context": design_context,
        },
        model="opus",
        effort="low",
        session_id=session_id,
    )
