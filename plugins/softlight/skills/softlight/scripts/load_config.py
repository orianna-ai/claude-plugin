import dataclasses
import functools
import json
import os
import pathlib


@functools.cache
def _config_path() -> pathlib.Path | None:
    config_dir = pathlib.Path.home() / ".claude" / "softlight"
    config_dir.mkdir(parents=True, exist_ok=True)

    if session_start_event := os.environ.get("CLAUDE_CODE_SESSION_START_EVENT"):
        session_id = json.loads(session_start_event)["session_id"]
        return config_dir / f"{session_id}.json"
    else:
        return None


@dataclasses.dataclass(kw_only=True)
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations."""

    base_url: str | None = None
    frpc_pid: int | None = None
    port: int | None = None
    problem_statement: str | None = None
    project_id: str | None = None
    project_url: str | None = None
    tunnel_id: str | None = None
    tunnel_url: str | None = None

    def __enter__(self) -> "Config":
        return self

    def __exit__(self, *_) -> None:
        self.save()

    def display(self) -> None:
        for k, v in dataclasses.asdict(self).items():
            print(f"{k}={v!r}")

    def save(self) -> None:
        if config_path := _config_path():
            config_path.write_text(json.dumps(dataclasses.asdict(self)))


@functools.cache
def load_config() -> Config:
    config_path = _config_path()

    if config_path is not None and config_path.exists():
        return Config(**json.loads(config_path.read_text()))
    else:
        return Config()


def main() -> None:
    config = load_config()

    config.display()


if __name__ == "__main__":
    main()
