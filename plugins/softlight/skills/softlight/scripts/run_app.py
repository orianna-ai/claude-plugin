from __future__ import annotations

import os
import socket
import subprocess
from typing import TYPE_CHECKING

from scripts.start_tunnel import start_tunnel

if TYPE_CHECKING:
    from scripts.load_config import Config


def run_app(
    config: Config,
    *,
    source_code_dir: str,
    tunnel_id: str,
) -> None:
    # install third-party dependencies and build the app
    subprocess.run(
        ["pnpm", "install"],
        cwd=source_code_dir,
        check=True,
    )

    subprocess.run(
        ["pnpm", "build"],
        cwd=source_code_dir,
        check=True,
    )

    # locate a free port to run the app
    with socket.socket() as sock:
        sock.bind(("", 0))
        port = sock.getsockname()[1]

    subprocess.Popen(
        ["pnpm", "preview", "--port", str(port)],
        cwd=source_code_dir,
        env={**os.environ, "SOFTLIGHT_PROJECT_ID": config.project_id},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # tunnel the port to make it accessible to softlight
    start_tunnel(
        config=config,
        port=port,
        tunnel_id=tunnel_id,
    )
