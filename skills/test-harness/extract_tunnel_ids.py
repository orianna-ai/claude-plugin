#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib
from typing import Any

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent


def _load_events(
    file_name: str,
) -> list[dict[str, Any]]:
    events_file = SCRIPT_DIR / "events" / f"{file_name}.json"

    if not events_file.exists():
        raise FileNotFoundError(events_file)

    with open(events_file) as f:
        return json.load(f)


def _extract_tunnel_ids(
    events: list[dict[str, Any]],
) -> list[str]:
    tunnel_ids: set[str] = set()

    for event in events:
        match event["type"]:
            case "project_updated":
                if baseline := (event.get("problem") or {}).get("baseline"):
                    if tid := baseline.get("tunnel_id"):
                        tunnel_ids.add(tid)
            case "slot_created":
                element = event.get("slot", {}).get("element", {})
                if element.get("type") == "iframe":
                    if tid := element.get("tunnel_id"):
                        tunnel_ids.add(tid)
            case "slot_updated":
                element = event.get("element", {})
                if element.get("type") == "iframe":
                    if tid := element.get("tunnel_id"):
                        tunnel_ids.add(tid)

    return sorted(tunnel_ids)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "file_name",
        help="Name of the events file (without .json extension)",
    )
    args = parser.parse_args()

    events = _load_events(args.file_name)
    tunnel_ids = _extract_tunnel_ids(events)

    print(json.dumps(tunnel_ids))


if __name__ == "__main__":
    main()
