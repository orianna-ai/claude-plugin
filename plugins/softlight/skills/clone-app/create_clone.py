#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile


def _create_package_json(
    target_dir: pathlib.Path,
    source_dir: pathlib.Path,
) -> None:
    source_package_json = next(
        (
            json.loads(package_json_path.read_text())
            for dir in (source_dir, *source_dir.parents)
            if (package_json_path := dir / "package.json")
            if package_json_path.is_file()
        ),
        {},
    )

    package_json = json.dumps(
        {
            "name": "clone",
            "private": True,
            "version": "0.0.0",
            "type": "module",
            "scripts": {
                "build": "tsc -b && vite build",
                "preview": "vite preview --host 0.0.0.0",
            },
            "dependencies": {
                **source_package_json.get("dependencies", {}),
            },
            "devDependencies": {
                **source_package_json.get("devDependencies", {}),
                "@vitejs/plugin-react": "^6.0.1",
                "vite": "^8.0.9",
            },
        },
        indent=2,
    )

    (target_dir / "package.json").write_text(package_json)


def _create_tsconfig_json(
    target_dir: pathlib.Path,
) -> None:
    tsconfig_json = json.dumps(
        {
            "compilerOptions": {
                "allowImportingTsExtensions": True,
                "jsx": "react-jsx",
                "lib": ["ES2023", "DOM"],
                "module": "esnext",
                "moduleDetection": "force",
                "moduleResolution": "bundler",
                "noEmit": True,
                "skipLibCheck": True,
                "strict": False,
                "target": "es2023",
                "types": ["vite/client"],
            },
            "include": [
                "src",
            ],
        },
        indent=2,
    )

    (target_dir / "tsconfig.json").write_text(tsconfig_json)


def _create_index_html(
    target_dir: pathlib.Path,
) -> None:
    index_html = """\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clone</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="main.tsx"></script>
  </body>
</html>
"""

    (target_dir / "index.html").write_text(index_html)


def _create_vite_config_ts(
    target_dir: pathlib.Path,
) -> None:
    vite_config_ts = """\
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
"""

    (target_dir / "vite.config.ts").write_text(vite_config_ts)


_RELATIVE_IMPORTS = re.compile(
    r"""(?:^|[\s;(])                              # leading boundary
        (?:import\b|export\b|require\s*\()        # import / export / require(
        [^'"`]*?                                  # up to the opening quote (non-greedy)
        ['"`](?P<path>\.{1,2}/[^'"`]+)['"`]       # ./ or ../ path
    """,
    re.VERBOSE | re.MULTILINE,
)


_TYPESCRIPT_SUFFIXES = (
    ".ts",
    ".tsx",
)


def _copy_src(
    target_dir: pathlib.Path,
    source_dir: pathlib.Path,
) -> None:
    # include all files in `source_dir`
    source_files = set()

    for dirpath, dirnames, filenames in os.walk(source_dir):
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if dirname not in {"node_modules", ".git", "dist", ".next", ".turbo", "build"}
        ]

        for filename in filenames:
            source_file = pathlib.Path(dirpath) / filename
            source_files.add(source_file)

    # include all files transitively referenced by relative imports in `source_files`
    queue = list(source_files)

    while queue:
        current_file = queue.pop()

        if current_file.suffix not in _TYPESCRIPT_SUFFIXES:
            continue

        for match in _RELATIVE_IMPORTS.finditer(current_file.read_text()):
            imported_file = (current_file.parent / match["path"]).resolve()

            if imported_file.is_file():
                if imported_file not in source_files:
                    source_files.add(imported_file)
                    queue.append(imported_file)
            else:
                for typescript_suffix in _TYPESCRIPT_SUFFIXES:
                    imported_file_with_suffix = imported_file.with_suffix(typescript_suffix)
                    if imported_file_with_suffix.is_file():
                        if imported_file_with_suffix not in source_files:
                            source_files.add(imported_file_with_suffix)
                            queue.append(imported_file_with_suffix)

    root_dir = pathlib.Path(os.path.commonpath(source_files))

    for source_file in source_files:
        target_file = target_dir / source_file.relative_to(root_dir)
        target_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, target_file)


def _install_dependencies(
    target_dir: pathlib.Path,
) -> None:
    subprocess.run(
        [
            "pnpm",
            "install",
            "--prefer-offline",
        ],
        cwd=target_dir,
        check=True,
    )


def create_clone(
    source_dir: pathlib.Path,
) -> pathlib.Path:
    target_dir = pathlib.Path(tempfile.mkdtemp(prefix="clone."))

    _create_package_json(target_dir, source_dir)
    _create_tsconfig_json(target_dir)
    _create_index_html(target_dir)
    _create_vite_config_ts(target_dir)
    _copy_src(target_dir, source_dir)
    _install_dependencies(target_dir)

    return target_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=pathlib.Path)
    args = parser.parse_args()

    target_dir = create_clone(args.source_dir.resolve())
    print(target_dir)


if __name__ == "__main__":
    main()
