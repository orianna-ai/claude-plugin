from __future__ import annotations

import dataclasses
import functools
import importlib
import pathlib
import pkgutil
import time
import traceback
from collections.abc import Callable

from scripts.load_config import Config
from scripts.post_events import post_events

_Call = Callable[[Config], None]


@dataclasses.dataclass
class Task:
    """A long-lived background job that runs for the lifetime of the agent.

    Tasks are not expected to ever return: an exception or a clean exit is treated as a failure,
    reported as an ``agent_task_failed`` event, and followed by a restart with exponential
    backoff (until :attr:`max_restarts` is reached, if set).

    :ivar call: Function that runs the task.
    :ivar max_restarts: Maximum number of times to restart the task after failure or early exit.
    :ivar name: Name of the task.
    """

    call: _Call
    max_restarts: int | None
    name: str


TASKS: dict[str, Task] = {}


def task(
    *,
    max_restarts: int | None = None,
) -> Callable[[_Call], Task]:
    """Register a function as a long-lived agent task.

    .. code-block:: python

        @task()
        def emit_heartbeats(config: Config) -> None:
            while True:
                post_events(config=config, events=[{"type": "heartbeat"}])

                time.sleep(30)

    :param max_restarts: Maximum number of times to restart the task after failure or early exit.
    :returns: A decorator that wraps the given function as a :class:`Task`.
    """

    def decorator(call: _Call) -> Task:
        task = Task(
            name=call.__name__,
            call=_with_restarts(call, max_restarts=max_restarts),
            max_restarts=max_restarts,
        )

        TASKS[call.__name__] = task

        return task

    return decorator


def _with_restarts(
    call: _Call,
    *,
    max_restarts: int | None,
) -> _Call:
    @functools.wraps(call)
    def wrapper(config: Config) -> None:
        restart_count = 0

        while True:
            try:
                call(config)
            except Exception:
                error = traceback.format_exc()

                traceback.print_exc()
            else:
                error = "task exited without raising an exception"

            _post_agent_task_failed(
                config,
                error=error,
                restart_count=restart_count,
                task=call.__name__,
            )

            if max_restarts is not None and restart_count >= max_restarts:
                return

            restart_count += 1

            time.sleep(min(60, 2 ** min(restart_count, 6)))

    return wrapper


def _post_agent_task_failed(
    config: Config,
    *,
    error: str,
    restart_count: int,
    task: str,
) -> None:
    try:
        post_events(
            config=config,
            events=[
                {
                    "type": "agent_task_failed",
                    "task": task,
                    "error": error,
                    "restart_count": restart_count,
                },
            ],
        )
    except Exception:
        traceback.print_exc()


# register tasks as an import side-effect
def _register_tasks() -> None:
    module_path = str(pathlib.Path(__file__).parent)
    module_name = __name__.rsplit(".", 1)[0]

    for submodule in pkgutil.iter_modules([module_path]):
        submodule_name = f"{module_name}.{submodule.name}"
        if submodule_name != __name__:
            importlib.import_module(submodule_name)


_register_tasks()
