---
name: start-application
description: Figure out how to build and serve a web application on a free port, and return the port, PID, and project info.
---

# Start Application

Your task is to figure out how to build and serve a web application on a free port. It is ok if
multiple instances of the same app are running in parallel — that is intended.

## Workflow

### 1. Understand the project

Look for clues in the project root to figure out how the app is built and how to run it:
- **`package.json`** — check `scripts` for `dev`, `start`, `serve`, or `build` commands. Note
  the package manager (`npm`, `yarn`, `pnpm`) and key dependencies.
- **`Makefile`** — look for `run`, `dev`, or `serve` targets.
- **`README.md`** — often has setup and run instructions.

While you're exploring, note things that would help someone make changes to the app later:
- **Framework** (e.g. Next.js, Vite + React, SvelteKit, Nuxt, Remix)
- **Source layout** — where components, pages, routes, and styles live
- **Entry point** (e.g. `src/main.tsx`, `src/App.tsx`, `pages/index.tsx`)
- **Styling approach** (CSS modules, Tailwind, styled-components, plain CSS)
- **Routing** (file-based, React Router, vue-router, etc.)

### 2. Install dependencies and build

If the project needs setup before running (e.g. `npm install`, `pip install -e .`, `go build`),
run that first. Skip if `node_modules` or equivalent already exists and looks current.

### 3. Pick a free port

Check which ports are in use: `ss -tlnp` or `lsof -i :8080`.

Start with 8080 and increment (8081, 8082, …) until you find a free one. Most frameworks accept
a **PORT** env var — prefer that over CLI flags when available.

### 4. Start the app

Run the app in the background and note its **PID**.

Poll every 3 seconds until the app responds:
```
sleep 3 && curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>
```
Any 2xx or 3xx status means it's up. Keep polling — builds can take a few minutes.

### 5. Return

- The **port** it's listening on
- The app **PID**
- The **run command** used to start it
- **Project info** — framework, language, source layout, entry point, styling approach, routing,
  package manager, and key config files. Include enough detail that a downstream agent could
  start making changes without re-exploring the project.
