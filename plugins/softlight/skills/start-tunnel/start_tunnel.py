import argparse
import io
import os
import pathlib
import platform
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import uuid

_FRPC_VERSION = "0.67.0"


_FRPC_BINARY_NAME = {
    ("Linux", "x86_64"): f"frp_{_FRPC_VERSION}_linux_amd64",
    ("Linux", "aarch64"): f"frp_{_FRPC_VERSION}_linux_arm64",
    ("Darwin", "x86_64"): f"frp_{_FRPC_VERSION}_darwin_amd64",
    ("Darwin", "arm64"): f"frp_{_FRPC_VERSION}_darwin_arm64",
}


def _frpc_binary() -> pathlib.Path:
    binary_name = _FRPC_BINARY_NAME[(platform.system(), platform.machine())]

    path = pathlib.Path(tempfile.gettempdir()) / binary_name / "frpc"

    if path.exists() and os.access(path, os.X_OK):
        return path

    with urllib.request.urlopen(
        f"https://github.com/fatedier/frp/releases/download/v{_FRPC_VERSION}/{binary_name}.tar.gz",
        timeout=10,
    ) as response:
        data = io.BytesIO(response.read())

    with tarfile.open(fileobj=data, mode="r:gz") as tar:
        tar.extractall(path=tempfile.gettempdir())

    return path


def _frpc_image() -> str:
    return f"fatedier/frpc:v{_FRPC_VERSION}"


def _frpc_config(
    tunnel_id: str,
    port: int,
) -> pathlib.Path:
    frpc_config = pathlib.Path(tempfile.mkdtemp()) / "frpc.toml"

    frpc_config.write_text(
        f"""\
serverAddr = "frp.orianna.ai"
serverPort = 443

[log]
disablePrintColor = true

[transport]
protocol = "wss"

[[proxies]]
customDomains = ["frp-gateway.orianna.ai"]
hostHeaderRewrite = "localhost"
httpUser = "{tunnel_id}"
localIP = "127.0.0.1"
localPort = {port}
name = "{tunnel_id}"
routeByHTTPUser = "{tunnel_id}"
type = "http"
""",
    )

    return frpc_config


def _is_docker_available() -> bool:
    try:
        subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _frpc_process(
    tunnel_id: str,
    port: int,
) -> subprocess.Popen:
    frpc_config = _frpc_config(tunnel_id, port)

    if _is_docker_available():
        subprocess.run(
            [
                "docker",
                "pull",
                _frpc_image(),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

        return subprocess.Popen(
            [
                "docker",
                "run",
                "--rm",
                "--network",
                "host",
                "-v",
                f"{frpc_config!s}:/etc/frp/frpc.toml",
                _frpc_image(),
                "-c",
                "/etc/frp/frpc.toml",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    else:
        return subprocess.Popen(
            [
                str(_frpc_binary()),
                "-c",
                str(frpc_config),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )


def _is_accessible(
    url: str,
) -> bool:
    for _ in range(20):
        time.sleep(0.25)

        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "claude-code",
                    },
                ),
                timeout=10,
            ) as response:
                if 200 <= response.status < 400:
                    return True
        except (urllib.error.URLError, OSError):
            continue

    return False


def start_tunnel(
    *,
    port: int,
) -> None:
    if not _is_accessible(f"http://localhost:{port}"):
        raise ValueError(f"application is not running on port {port}")

    tunnel_id = str(uuid.uuid4())
    print(f"{tunnel_id=}")

    frpc = _frpc_process(tunnel_id, port)
    print(f"{frpc.pid=}")

    tunnel_url = f"https://softlight.orianna.ai/api/tunnel/{tunnel_id}/"
    print(f"{tunnel_url=}")

    if not _is_accessible(tunnel_url):
        frpc.kill()
        _, stderr = frpc.communicate()
        raise ValueError(f"tunnel failed to start:\n{stderr.decode(errors='replace')}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True, type=int)
    args = parser.parse_args()

    start_tunnel(
        port=args.port,
    )


if __name__ == "__main__":
    main()
