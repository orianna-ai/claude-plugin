import dataclasses
import functools
from typing import Any


@dataclasses.dataclass(kw_only=True)
class Config:
    """Mutable configuration that is preserved across ``claude`` invocations."""

    base_url: str
    project_id: str
    transcripts: dict[str, list[dict[str, Any]]]

    def display(self) -> None:
        for k, v in dataclasses.asdict(self).items():
            print(f"{k}={v!r}")


@functools.cache
def load_config(project_id: str) -> Config:
    return Config(
        base_url="http://localhost:8080",
        project_id=project_id,
        transcripts={},
    )
