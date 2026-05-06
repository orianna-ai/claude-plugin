import json
import pathlib
import subprocess
import tempfile


def _create_package_json(
    output_dir: pathlib.Path,
    source_code_dir: pathlib.Path,
) -> None:
    source_package_json = next(
        (
            json.loads(package_json_path.read_text())
            for dir in (source_code_dir, *source_code_dir.parents)
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

    (output_dir / "package.json").write_text(package_json)


def _create_tsconfig_json(
    output_dir: pathlib.Path,
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

    (output_dir / "tsconfig.json").write_text(tsconfig_json)


def _create_index_html(
    output_dir: pathlib.Path,
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
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

    (output_dir / "index.html").write_text(index_html)


def _create_vite_config_ts(
    output_dir: pathlib.Path,
) -> None:
    vite_config_ts = """\
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
"""

    (output_dir / "vite.config.ts").write_text(vite_config_ts)


def _create_main_tsx(
    output_dir: pathlib.Path,
) -> None:
    main_tsx = """\
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
"""

    src_dir = output_dir / "src"
    src_dir.mkdir(exist_ok=True)
    (src_dir / "main.tsx").write_text(main_tsx)


def _create_app_tsx(
    output_dir: pathlib.Path,
) -> None:
    app_tsx = """\
export function App() {
  return <div>Clone</div>
}
"""

    src_dir = output_dir / "src"
    src_dir.mkdir(exist_ok=True)
    (src_dir / "App.tsx").write_text(app_tsx)


def _install_dependencies(
    output_dir: pathlib.Path,
) -> None:
    subprocess.run(
        [
            "pnpm",
            "install",
            "--prefer-offline",
        ],
        cwd=output_dir,
        check=True,
    )


def create_app(
    source_code_dir: pathlib.Path,
) -> pathlib.Path:
    output_dir = pathlib.Path(tempfile.mkdtemp(prefix="clone."))

    _create_package_json(output_dir, source_code_dir)
    _create_tsconfig_json(output_dir)
    _create_index_html(output_dir)
    _create_vite_config_ts(output_dir)
    _create_main_tsx(output_dir)
    _create_app_tsx(output_dir)
    _install_dependencies(output_dir)
    print(f"[clone_app] cloned app scaffold ready at {output_dir}")

    return output_dir
