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
        timeout=30,
    ) as response:
        if response.status >= 400:
            raise RuntimeError(f"failed to upload {path} ({response.status})")

        return response.read().decode().strip()
