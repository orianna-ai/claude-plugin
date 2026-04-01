#!/usr/bin/env python3
import argparse
import subprocess
import urllib.parse

from scripts.call_mcp import call_mcp
from scripts.load_config import load_config
from scripts.start_tunnel import start_tunnel


def _base_url(
    url: str,
) -> str:
    parsed_url = urllib.parse.urlparse(url)
    return f"{parsed_url.scheme}://{parsed_url.netloc}"


def setup_project(
    *,
    port: int,
    problem_statement: str,
) -> None:
    config = load_config()

    tunnel_id = start_tunnel(
        port=port,
    )

    git_commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        text=True,
    )

    create_project_output = call_mcp(
        tool="create_project",
        input={
            "git_commit": git_commit,
            "problem_statement": problem_statement,
            "tunnel_id": tunnel_id,
        },
        json_schema={
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                },
                "project_url": {
                    "type": "string",
                },
            },
            "required": [
                "project_id",
                "project_url",
            ],
        },
    )

    project_id = create_project_output["project_id"]
    config.project_id = project_id
    print(f"{project_id=}")

    project_url = create_project_output["project_url"]
    config.project_url = project_url
    print(f"{project_url=}")

    base_url = _base_url(project_url)
    config.base_url = base_url
    print(f"{base_url=}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port",
        required=True,
        type=int,
        help="The port on which the application is running",
    )
    parser.add_argument(
        "--problem-statement",
        required=True,
        help="The problem statement for the project",
    )
    args = parser.parse_args()

    setup_project(
        problem_statement=args.problem_statement,
        port=args.port,
    )


if __name__ == "__main__":
    main()
