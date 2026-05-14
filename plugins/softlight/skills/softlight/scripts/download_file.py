import pathlib
import tempfile
import urllib.parse
import urllib.request


def download_file(
    url: str,
) -> pathlib.Path:
    """Download ``url`` to a freshly created temporary directory.

    The filename is taken from the trailing path segment of the URL.

    :param url: HTTP(S) URL to fetch.
    :returns: Path to the downloaded file on local disk.
    """
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
