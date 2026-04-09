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

from scripts.load_config import load_config

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


def _frpc_config(
    tunnel_id: str,
    port: int,
) -> pathlib.Path:
    path = pathlib.Path(tempfile.gettempdir()) / f"frpc-{tunnel_id}.toml"

    path.write_text(
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
localIP = "localhost"
localPort = {port}
name = "{tunnel_id}"
routeByHTTPUser = "{tunnel_id}"
type = "http"
""",
    )

    return path


def _frpc_process(
    tunnel_id: str,
    port: int,
) -> subprocess.Popen:
    binary = _frpc_binary()

    config = _frpc_config(tunnel_id, port)

    frpc = subprocess.Popen(
        [str(binary), "-c", str(config)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

    return frpc


def _is_accessible(
    port: int,
) -> bool:
    for _ in range(5):
        time.sleep(0.25)

        try:
            with urllib.request.urlopen(
                f"http://localhost:{port}",
                timeout=10,
            ) as response:
                if 200 <= response.status < 400:
                    return True
        except (urllib.error.URLError, OSError):
            continue

    return False


def setup_tunnel() -> None:
    with load_config() as config:
        assert config.app_url is not None
        assert config.app_port is not None

        if not _is_accessible(config.app_port):
            raise ValueError(f"application running on port {config.app_port} is not accessible")

        print(f"creating tunnel to {config.app_url}")

        tunnel_id = str(uuid.uuid4())
        config.tunnel_id = tunnel_id
        config.tunnel_url = f"{config.base_url}/api/tunnel/{tunnel_id}/"

        frpc = _frpc_process(tunnel_id, config.app_port)
        config.pids.append(frpc.pid)


def main() -> None:
    setup_tunnel()


if __name__ == "__main__":
    main()
