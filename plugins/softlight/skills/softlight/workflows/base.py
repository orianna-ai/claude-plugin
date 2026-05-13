import dataclasses
import functools
import importlib
import inspect
import pathlib
import pkgutil
import traceback
from collections.abc import Mapping
from typing import Any, Callable, Generic, TypeVar, get_type_hints

from scripts.load_config import Config

_Params = TypeVar("_Params", bound=Mapping[str, Any])

_Call = Callable[[Config, _Params], None]


def _infer_schema(
    call: _Call[_Params],
) -> dict[str, Any]:
    signature = inspect.signature(call)
    params_name = list(signature.parameters)[1]
    params_type = get_type_hints(call)[params_name]
    type_hints = get_type_hints(params_type)

    return {
        "type": "object",
        "properties": {name: {"type": "string"} for name in type_hints},
        "required": list(type_hints),
        "additionalProperties": False,
    }


@dataclasses.dataclass
class Workflow(Generic[_Params]):
    call: _Call[_Params]
    description: str
    name: str
    schema: dict[str, Any]


WORKFLOWS: dict[str, Workflow[Any]] = {}


def workflow(
    *,
    max_attempts: int = 1,
) -> Callable[[_Call[_Params]], Workflow[_Params]]:
    def decorator(
        call: _Call[_Params],
    ) -> Workflow[_Params]:
        description = inspect.getdoc(call)
        assert description, f"workflow {call.__name__!r} must have a docstring"

        workflow = Workflow(
            name=call.__name__,
            description=description,
            call=_with_retries(call, max_attempts=max_attempts),
            schema=_infer_schema(call),
        )

        WORKFLOWS[call.__name__] = workflow

        return workflow

    return decorator


def _with_retries(
    call: _Call[_Params],
    *,
    max_attempts: int,
) -> _Call[_Params]:
    @functools.wraps(call)
    def wrapper(
        config: Config,
        params: _Params,
    ) -> None:
        attempt = 0

        while True:
            try:
                call(config, params)
            except Exception as exception:
                traceback.print_exc()

                attempt += 1

                if attempt >= max_attempts:
                    raise exception
            else:
                return

    return wrapper


# register workflows as an import side-effect
def _register_workflows() -> None:
    module_path = str(pathlib.Path(__file__).parent)
    module_name = __name__.rsplit(".", 1)[0]

    for submodule in pkgutil.iter_modules([module_path]):
        submodule_name = f"{module_name}.{submodule.name}"
        if submodule_name != __name__:
            importlib.import_module(submodule_name)


_register_workflows()
