import argparse
import concurrent.futures

from scripts.load_config import load_config
from scripts.spawn_reaper import spawn_reaper
from tasks.base import TASKS


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    config = load_config(args.project_id)

    spawn_reaper(config)

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=len(TASKS),
    ) as executor:
        for task in TASKS.values():
            executor.submit(task.call, config)


if __name__ == "__main__":
    main()
