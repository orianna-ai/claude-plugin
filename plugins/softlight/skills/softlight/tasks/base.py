import functools
import importlib
import pathlib
import pkgutil
import time
import traceback
from collections.abc import Callable

from scripts.load_config import Config
from scripts.post_events import post_events

TASKS: list[Callable[[Config], None]] = []


def task(
    f: Callable[[Config], None],
) -> Callable[[Config], None]:
    @functools.wraps(f)
    def wrapper(config: Config) -> None:
        restart_count = 0

        while True:
            try:
                f(config)
            except Exception:
                traceback.print_exc()

                post_events(
                    config=config,
                    events=[
                        {
                            "type": "agent_task_failed",
                            "task": f.__name__,
                            "error": traceback.format_exc(),
                            "restart_count": restart_count,
                        },
                    ],
                )

                restart_count += 1

                time.sleep(min(60, 2 ** min(restart_count, 6)))
            else:
                return

    TASKS.append(wrapper)

    return wrapper


# register tasks as an import side-effect
def _register_tasks() -> None:
    module_path = str(pathlib.Path(__file__).parent)
    module_name = __name__.rsplit(".", 1)[0]

    for submodule in pkgutil.iter_modules([module_path]):
        submodule_name = f"{module_name}.{submodule.name}"
        if submodule_name != __name__:
            importlib.import_module(submodule_name)


_register_tasks()
