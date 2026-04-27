import uuid

from scripts.load_config import load_config


def start_intake() -> None:
    project_id = str(uuid.uuid4())
    print(f"{project_id=}")

    config = load_config(project_id)

    intake_url = f"{config.base_url}/intake/{project_id}"
    print(f"{intake_url=}")


if __name__ == "__main__":
    start_intake()
