from scripts.load_config import load_config

from workflows.setup_app import setup_app
from workflows.setup_problem import setup_problem
from workflows.setup_project import setup_project
from workflows.setup_tunnel import setup_tunnel


def main() -> None:
    setup_problem()
    setup_app()
    setup_tunnel()
    setup_project()

    with load_config() as config:
        config.display()


if __name__ == "__main__":
    main()
