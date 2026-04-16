import argparse
import contextlib
import os
import signal
import subprocess
import sys
import time

from scripts.load_config import Config


def spawn_reaper(
    config: Config,
) -> None:
    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "scripts.spawn_reaper",
            "--pid",
            str(os.getpid()),
            "--project-id",
            config.project_id,
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def _wait_for_exit(
    pid: int,
) -> None:
    while True:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break

        time.sleep(5)


def _kill_subprocesses(
    project_id: str,
) -> None:
    marker = f"SOFTLIGHT_PROJECT_ID={project_id}\x00".encode()

    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue

        pid = int(entry)

        try:
            with open(f"/proc/{pid}/environ", "rb") as file:
                environ = file.read()
        except OSError:
            continue

        if marker in environ:
            with contextlib.suppress(OSError):
                os.kill(pid, signal.SIGKILL)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--project-id", type=str, required=True)
    args = parser.parse_args()

    _wait_for_exit(args.pid)

    _kill_subprocesses(args.project_id)


if __name__ == "__main__":
    main()
