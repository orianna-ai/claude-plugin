import os
import json


def main() -> None:
    print(json.dumps(dict(os.environ), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

