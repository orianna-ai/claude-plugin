from scripts.call_claude import call_claude
from scripts.load_config import load_config


def setup_problem() -> None:
    with load_config() as config:
        print("determining design problem")

        generate_problem_output = call_claude(
            prompt="/generate-problem",
            allowed_tools=[],
            json_schema={
                "type": "object",
                "properties": {
                    "problem": {
                        "type": "string",
                    },
                },
                "required": ["problem"],
            },
            effort="low",
            model="haiku",
            tools=["Read", "Glob", "Grep"],
        )

        config.problem = generate_problem_output["problem"]


def main() -> None:
    setup_problem()


if __name__ == "__main__":
    main()
