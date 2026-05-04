import dataclasses
import importlib
import inspect
import pathlib
import pkgutil
from collections.abc import Mapping
from typing import Any, Callable, Generic, TypeVar, get_type_hints

from scripts.load_config import Config

_Params = TypeVar("_Params", bound=Mapping[str, Any])

_Call = Callable[[Config, _Params], None]


def _infer_schema(
    cls: type[_Params],
) -> dict[str, Any]:
    hints = get_type_hints(cls)
    return {
        "type": "object",
        "properties": {name: {"type": "string"} for name in hints},
        "required": list(hints),
        "additionalProperties": False,
    }


@dataclasses.dataclass(frozen=True, slots=True)
class Workflow(Generic[_Params]):
    call: _Call[_Params]
    description: str
    name: str
    schema: dict[str, Any]


WORKFLOWS: dict[str, Workflow[Any]] = {}


def workflow(
    call: _Call[_Params],
) -> Workflow[_Params]:
    description = inspect.getdoc(call)
    if not description:
        raise ValueError(f"workflow {call.__name__!r} must have a docstring")

    sig = inspect.signature(call)
    params_name = list(sig.parameters)[1]
    params_type = get_type_hints(call)[params_name]

    workflow = Workflow(
        name=call.__name__,
        description=description,
        call=call,
        schema=_infer_schema(params_type),
    )

    WORKFLOWS[call.__name__] = workflow

    return workflow


# register workflows as an import side-effect
def _register_workflows() -> None:
    module_path = str(pathlib.Path(__file__).parent)
    module_name = __name__.rsplit(".", 1)[0]

    for submodule in pkgutil.iter_modules([module_path]):
        submodule_name = f"{module_name}.{submodule.name}"
        if submodule_name != __name__:
            importlib.import_module(submodule_name)


_register_workflows()
