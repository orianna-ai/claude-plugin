import socket
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

        print(f"cloning application to {tmpdir}")

        clone_app_output = call_claude(
            prompt=f"""\
/clone-app
<path>{tmpdir}</path>
<problem>{config.problem}</problem>
""",
            json_schema={
                "type": "object",
                "properties": {
                    "pid": {
                        "type": "number",
                    },
                    "port": {
                        "type": "number",
                    },
                },
                "required": ["port", "pid"],
            },
            effort="max",
            model="opus",
            timeout=1200,
        )

        config.app_url = f"http://localhost:{clone_app_output['port']}"
        config.app_workspace = tmpdir
        config.app_port = clone_app_output["port"]
        config.pids.append(clone_app_output["pid"])


def main() -> None:
    setup_app()


if __name__ == "__main__":
    main()
