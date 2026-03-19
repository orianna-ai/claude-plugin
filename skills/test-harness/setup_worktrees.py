#!/usr/bin/env python3
from __future__ import annotations

import argparse
import dataclasses
import json
import pathlib
import subprocess
import tempfile
import uuid
from typing import Any

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent


@dataclasses.dataclass(frozen=True, kw_only=True)
class Worktree:
    git_commit: str
    git_patch_url: str | None
    id: uuid.UUID = dataclasses.field(default_factory=uuid.uuid4)
    tunnel_id: str

    @property
    def path(
        self,
    ) -> str:
        return str(pathlib.Path(tempfile.gettempdir()) / f"worktree-{self.id.hex[:8]}")


def _load_events(
    file_name: str,
) -> list[dict[str, Any]]:
    events_file = SCRIPT_DIR / "events" / f"{file_name}.json"

    if not events_file.exists():
        raise FileNotFoundError(events_file)

    with open(events_file) as f:
        return json.load(f)


def _list_worktrees(
    events: list[dict[str, Any]],
) -> set[Worktree]:
    worktrees = set()

    for event in events:
        match event["type"]:
            case "project_updated":
                if baseline := event.get("problem", {}).get("baseline"):
                    worktrees.add(
                        Worktree(
                            tunnel_id=baseline["tunnel_id"],
                            git_commit=baseline["git_commit"],
                            git_patch_url=baseline.get("git_patch_url"),
                        ),
                    )
            case "slot_created":
                if element := event.get("slot", {}).get("element", {}):
                    if element["type"] == "iframe":
                        worktrees.add(
                            Worktree(
                                tunnel_id=element["tunnel_id"],
                                git_commit=element["git_commit"],
                                git_patch_url=element.get("git_patch_url"),
                            ),
                        )
            case "slot_updated":
                if element := event.get("element", {}):
                    if element["type"] == "iframe":
                        worktrees.add(
                            Worktree(
                                tunnel_id=element["tunnel_id"],
                                git_commit=element["git_commit"],
                                git_patch_url=element.get("git_patch_url"),
                            ),
                        )

    return worktrees


def _create_worktree(
    worktree: Worktree,
) -> None:
    subprocess.run(
        [
            "git",
            "worktree",
            "add",
            "--detach",
            worktree.path,
            worktree.git_commit,
        ],
        check=True,
    )

    if worktree.git_patch_url:
        subprocess.run(
            [
                "git",
                "apply",
                "--directory",
                worktree.path,
                worktree.git_patch_url,
            ],
            check=True,
        )


def _display_worktrees(
    worktrees: set[Worktree],
) -> None:
    print(
        json.dumps(
            [dataclasses.asdict(workspace) for workspace in worktrees],
            indent=2,
            default=str,
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "file_name",
        help="Name of the events file (without .json extension)",
    )
    args = parser.parse_args()

    events = _load_events(args.file_name)

    worktrees = _list_worktrees(events)

    for worktree in worktrees:
        _create_worktree(worktree)

    _display_worktrees(worktrees)


if __name__ == "__main__":
    main()
