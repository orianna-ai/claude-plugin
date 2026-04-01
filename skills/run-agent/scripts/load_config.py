import dataclasses
import functools
import json
import os
from typing import ClassVar


@dataclasses.dataclass(kw_only=True)
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations."""

    ENVIRONMENT_VARIABLE: ClassVar[str] = "SOFTLIGHT_CONFIG"

    base_url: str | None = None
    project_id: str | None = None
    project_url: str | None = None

    def dump_config(
        self,
    ) -> dict[str, str]:
        return {
            Config.ENVIRONMENT_VARIABLE: json.dumps(dataclasses.asdict(self)),
        }


@functools.cache
def load_config() -> Config:
    if config_json := os.environ.get(Config.ENVIRONMENT_VARIABLE):
        return Config(**json.loads(config_json))
    else:
        return Config()


def main() -> None:
    config = load_config()
    print(config)


if __name__ == "__main__":
    load_config()
