import socket
import subprocess
import tempfile

from scripts.call_claude import call_claude
from scripts.load_config import load_config


def _select_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


def setup_app() -> None:
    with load_config() as config:
        assert config.problem is not None

        tmpdir = tempfile.mkdtemp()

        print(f"scaffolding application in {tmpdir}")

        subprocess.check_call(
            [
                "npm",
                "create",
                "vite@latest",
                "--",
                "--template",
                "react-ts",
                "--no-interactive",
                ".",
            ],
            cwd=tmpdir,
        )

        subprocess.check_call(
            [
                "npm",
                "install",
                "--no-audit",
                "--no-fund",
                "--no-progress",
                "--prefer-offline",
            ],
            cwd=tmpdir,
        )

        print(f"cloning application to {tmpdir}")

        call_claude(
            prompt=f"""\
/clone-app
<path>{tmpdir}</path>
<problem>{config.problem}</problem>
""",
            effort="max",
            model="opus",
            timeout=1200,
        )

        port = _select_port()

        print(f"starting application on port {port}")

        devserver = subprocess.Popen(
            [
                "npm",
                "run",
                "dev",
                "--",
                "--port",
                str(port),
            ],
            cwd=tmpdir,
        )

        if devserver.pid:
            config.app_url = f"http://localhost:{port}"
            config.app_workspace = tmpdir
            config.app_port = port
            config.pids.append(devserver.pid)


def main() -> None:
    setup_app()


if __name__ == "__main__":
    main()
