import argparse

from scripts.call_claude import call_claude
from scripts.load_config import load_config


def run_designer(
    *,
    project_id: str,
    problem_statement: str,
) -> None:
    while True:
        call_claude(
            prompt=f"""\
/design-step
<project_id>{project_id}</project_id>
<problem_statement>{problem_statement}</problem_statement>
""",
            model="opus",
            timeout=1200,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--project-id",
        required=True,
        help="The project to run the designer in.",
    )
    parser.add_argument(
        "--problem-statement",
        required=True,
        help="The problem statement for the project",
    )
    args = parser.parse_args()

    run_designer(
        project_id=args.project_id,
        problem_statement=args.problem_statement,
    )


if __name__ == "__main__":
    main()
