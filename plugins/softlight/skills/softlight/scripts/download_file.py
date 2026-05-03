import pathlib
import tempfile
import urllib.parse
import urllib.request


def download_file(
    url: str,
) -> pathlib.Path:
    filename = pathlib.PurePosixPath(urllib.parse.urlparse(url).path).name

    path = pathlib.Path(tempfile.mkdtemp()) / filename

    with urllib.request.urlopen(
        urllib.request.Request(
            url,
            headers={
                "User-Agent": "claude-code",
            },
        ),
    ) as response:
        path.write_bytes(response.read())

    return path
