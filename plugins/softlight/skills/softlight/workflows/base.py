import importlib
import pathlib
import pkgutil
from typing import Callable

from scripts.load_config import Config

Workflow = Callable[[Config, dict[str, str]], None]

WORKFLOWS: dict[str, Workflow] = {}


def workflow(
    f: Workflow,
) -> Workflow:
    WORKFLOWS[f.__name__] = f
    return f


# register workflows as an import side-effect
def _register_workflows() -> None:
    module_path = str(pathlib.Path(__file__).parent)
    module_name = __name__.rsplit(".", 1)[0]

    for submodule in pkgutil.iter_modules([module_path]):
        submodule_name = f"{module_name}.{submodule.name}"
        if submodule_name != __name__:
            importlib.import_module(submodule_name)


_register_workflows()
