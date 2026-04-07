#!/usr/bin/env python3
import argparse
import pathlib
import urllib.request
import uuid


def upload_file(
    path: str | pathlib.Path,
) -> str:
    if isinstance(path, str):
        path = pathlib.Path(path)

    boundary = uuid.uuid4().hex

    body = b"\r\n".join(
        [
            f"--{boundary}".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"'.encode(),
            b"",
            path.read_bytes(),
            f"--{boundary}--".encode(),
            b"",
        ],
    )

    request = urllib.request.Request(
        "https://drive.orianna.ai/api/v2/upload",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "orianna-upload/1.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status >= 400:
            raise RuntimeError(f"failed to upload {path} ({response.status})")

        return response.read().decode().strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "path",
        type=pathlib.Path,
        help="The path to the file to upload",
    )
    args = parser.parse_args()

    upload_file(
        path=args.path,
    )


if __name__ == "__main__":
    main()
