import dataclasses
import functools
import json
import os
import pathlib


@functools.cache
def _config_path() -> pathlib.Path:
    config_dir = pathlib.Path.home() / ".claude" / "softlight"
    config_dir.mkdir(parents=True, exist_ok=True)

    session_start_event = os.environ["CLAUDE_CODE_SESSION_START_EVENT"]
    session_id = json.loads(session_start_event)["session_id"]

    return config_dir / f"{session_id}.json"


@dataclasses.dataclass(kw_only=True)
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations."""

    base_url: str | None = None
    project_id: str | None = None
    project_url: str | None = None

    def save(self) -> None:
        config_path = _config_path()
        config_path.write_text(json.dumps(dataclasses.asdict(self)))


@functools.cache
def load_config() -> Config:
    config_path = _config_path()

    if config_path.exists():
        return Config(**json.loads(config_path.read_text()))
    else:
        return Config()


def main() -> None:
    config = load_config()

    print(config)


if __name__ == "__main__":
    load_config()
