#!/usr/bin/env python3
import argparse
import io
import os
import pathlib
import platform
import subprocess
import tarfile
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid

_FRPC_VERSION = "0.67.0"


def _frpc_binary_name() -> str:
    match (platform.system(), platform.machine()):
        case ("Linux", "x86_64"):
            return f"frp_{_FRPC_VERSION}_linux_amd64"
        case ("Linux", "aarch64"):
            return f"frp_{_FRPC_VERSION}_linux_arm64"
        case ("Darwin", "x86_64"):
            return f"frp_{_FRPC_VERSION}_darwin_amd64"
        case ("Darwin", "arm64"):
            return f"frp_{_FRPC_VERSION}_darwin_arm64"
        case (system, machine):
            raise ValueError(f"frpc is not supported on {system} {machine}")


def _frpc_binary() -> pathlib.Path:
    binary_name = _frpc_binary_name()

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

    return subprocess.Popen(
        [str(binary), "-c", str(config)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def _frpc_reaper(
    process: subprocess.Popen,
    port: int,
) -> None:
    while process.poll() is None:
        time.sleep(10)

        if not _is_accessible(port):
            process.terminate()
            process.wait(timeout=5)
            return


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


def start_tunnel(
    *,
    port: int,
) -> str:
    if not _is_accessible(port):
        raise ValueError(f"application running on port {port} is not accessible")

    tunnel_id = str(uuid.uuid4())
    print(f"{tunnel_id=}")

    frpc = _frpc_process(tunnel_id, port)
    print(f"{frpc.pid=}")

    thread = threading.Thread(target=_frpc_reaper, args=(frpc, port), daemon=True)
    thread.start()

    return tunnel_id


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port",
        required=True,
        type=int,
        help="The port on which the application is running",
    )
    args = parser.parse_args()

    start_tunnel(
        port=args.port,
    )


if __name__ == "__main__":
    main()
