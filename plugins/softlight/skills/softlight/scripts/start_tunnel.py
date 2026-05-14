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

from scripts.load_config import Config

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
    project_id: str,
    tunnel_id: str,
    port: int,
) -> subprocess.Popen:
    binary = _frpc_binary()

    config = _frpc_config(tunnel_id, port)

    frpc = subprocess.Popen(
        [str(binary), "-c", str(config)],
        env={**os.environ, "SOFTLIGHT_PROJECT_ID": project_id},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return frpc


def _can_access(
    url: str,
) -> bool:
    for _ in range(5):
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
    config: Config,
    *,
    port: int,
    tunnel_id: str,
) -> None:
    """Tunnel a local port to Softlight via ``frpc`` over WSS.

    Verifies the local service is responsive, downloads and caches the ``frpc`` binary for the
    current platform if needed, then launches it with a generated config pointing at
    ``frp.orianna.ai`` in the background. The tunnel is confirmed by probing the Softlight side; if
    that probe fails the ``frpc`` process is killed.

    :param config: Project configuration.
    :param port: Local port that the application is already listening on.
    :param tunnel_id: Stable identifier used as the HTTP-user / route key for the tunnel.
    :raises ValueError: If nothing is listening (or accessible) on ``port``.
    :raises RuntimeError: If the tunnel fails to come up on the Softlight side.
    """
    if not _can_access(f"http://localhost:{port}"):
        raise ValueError(f"application running on port {port} is not accessible")

    frpc = _frpc_process(
        project_id=config.project_id,
        tunnel_id=tunnel_id,
        port=port,
    )

    tunnel_url = f"{config.base_url}/api/tunnel/{tunnel_id}/"

    if not _can_access(tunnel_url):
        frpc.kill()
        frpc.wait()
        raise RuntimeError(f"failed to start tunnel for {tunnel_id}")
