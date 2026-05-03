import pathlib
import urllib.request
import uuid


def upload_file(
    path: pathlib.Path,
) -> str:
    if not path.is_file():
        raise RuntimeError(f"invalid path {path}")

    boundary = uuid.uuid4().hex

    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode(),
            b"Content-Type: application/octet-stream\r\n\r\n",
            path.read_bytes(),
            f"\r\n--{boundary}--\r\n".encode(),
        ],
    )

    with urllib.request.urlopen(
        urllib.request.Request(
            "https://drive.orianna.ai/api/v2/upload",
            data=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "claude-code",
            },
            method="POST",
        ),
    ) as response:
        return response.read().decode()
