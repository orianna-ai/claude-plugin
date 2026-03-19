#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import urllib.request
import uuid

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent


def _post_events(
    file_name: str,
) -> str:
    path = SCRIPT_DIR / "events" / f"{file_name}.json"

    if not path.exists():
        raise FileNotFoundError(path)

    project_id = str(uuid.uuid4())

    request = urllib.request.Request(
        f"http://localhost:8080/api/projects/{project_id}/events",
        data=path.read_bytes(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request):
        pass

    return project_id


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "file_name",
        help="Name of the events file (without .json extension)",
    )
    args = parser.parse_args()

    project_id = _post_events(args.file_name)

    print(project_id)


if __name__ == "__main__":
    main()
