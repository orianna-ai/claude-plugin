from typing import Callable

from scripts.load_config import Config

Workflow = Callable[[Config, dict[str, str]], None]

WORKFLOWS: dict[str, Workflow] = {}


def workflow(
    f: Workflow,
) -> Workflow:
    WORKFLOWS[f.__name__] = f
    return f
