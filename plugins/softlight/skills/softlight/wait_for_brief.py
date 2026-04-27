from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from typing import Any

from scripts.load_config import load_config

_POLL_INTERVAL_S = 2.0
_TIMEOUT_S = 60 * 30  # 30 minutes


def _fetch_brief(*, base_url: str, project_id: str) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                f"{base_url}/api/intake/briefs/{project_id}",
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "claude-code",
                },
            ),
            timeout=10,
        ) as response:
            data = response.read()
            if not data:
                return None
            value = json.loads(data)
            if value is None:
                return None
            return value
    except Exception:
        return None


def _format_brief(brief: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Softlight intake")
    lines.append("")
    lines.append("## Conversation")
    lines.append("")
    for turn in brief.get("transcript") or []:
        speaker = "User" if turn.get("role") == "user" else "Designer"
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        lines.append(f"**{speaker}:** {text}")
        lines.append("")
    extra = (brief.get("extra_context") or "").strip()
    if extra:
        lines.append("## Additional context")
        lines.append("")
        lines.append(extra)
        lines.append("")
    attachments = brief.get("attachments") or []
    if attachments:
        lines.append("## Attachments")
        lines.append("")
        for name in attachments:
            lines.append(f"- {name}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def wait_for_brief(*, project_id: str) -> None:
    config = load_config(project_id)
    deadline = time.monotonic() + _TIMEOUT_S
    while time.monotonic() < deadline:
        brief = _fetch_brief(base_url=config.base_url, project_id=project_id)
        if brief is not None:
            sys.stdout.write(_format_brief(brief))
            sys.stdout.flush()
            return
        time.sleep(_POLL_INTERVAL_S)
    raise SystemExit("timed out waiting for the intake brief to be submitted")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()
    wait_for_brief(project_id=args.project_id)


if __name__ == "__main__":
    main()
