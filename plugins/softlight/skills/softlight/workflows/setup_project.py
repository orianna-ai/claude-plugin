from scripts.call_mcp import call_mcp
from scripts.load_config import load_config
from scripts.run_subprocess import run_subprocess


def setup_project() -> None:
    with load_config() as config:
        assert config.problem is not None
        assert config.tunnel_id is not None

        print("creating softlight project")

        git_commit = run_subprocess(
            cmd=[
                "git",
                "rev-parse",
                "HEAD",
            ],
        )

        create_project_output = call_mcp(
            tool="create_project",
            input={
                "git_commit": git_commit,
                "problem_statement": config.problem,
                "tunnel_id": config.tunnel_id,
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

        config.project_id = create_project_output["project_id"]

        config.project_url = create_project_output["project_url"]


def main() -> None:
    setup_project()


if __name__ == "__main__":
    main()
