---
name: start-application
description: Figure out how to build and serve a web application on a free port, and return the port, PID, and project info.
---

# Start Application

Your task is to start a web application on a free port, the same way a developer working on the
project would. It is ok if multiple instances of the same app are running in parallel — that is
intended.

## Workflow

### 1. Understand the project

Figure out how developers run this application locally. Look for clues in the project root:
- **`package.json`** — check `scripts` for `dev`, `start`, `serve`, or `build` commands. Note
  the package manager (`npm`, `yarn`, `pnpm`) and key dependencies.
- **`Makefile`** — look for `run`, `dev`, or `serve` targets.
- **`README.md`** — often has setup and run instructions.

Most projects have a single command that starts everything needed (e.g. `npm run dev`, `make run`,
`docker compose up`, etc.). Prefer that over assembling your own serve setup.

While you're exploring, note things that would help someone make changes to the app later:
- **Framework** (e.g. Next.js, Vite + React, SvelteKit, Nuxt, Remix)
- **Source layout** — where components, pages, routes, and styles live
- **Entry point** (e.g. `src/main.tsx`, `src/App.tsx`, `pages/index.tsx`)
- **Styling approach** (CSS modules, Tailwind, styled-components, plain CSS)
- **Routing** (file-based, React Router, vue-router, etc.)

### 2. Pick a free port

You MUST find a free port to run the application. Even if the project README or run instructions
say to use a default port (e.g. 8080), that port may already be taken by another service. Always
check first and use a free port instead.

Check which ports are in use: `ss -tlnp` or `lsof -i :<port>`.

Start with 8080 and increment (8081, 8082, …) until you find a free one. Most frameworks accept
a **PORT** env var — prefer that over CLI flags when available.

### 3. Install dependencies and build

If the project needs setup before running (e.g. `npm install`, `pip install -e .`, `go build`),
run that first. Skip dependency installation if it looks already done (e.g. `node_modules` exists
and lock file hasn't changed) — but always use the project's own start command regardless.

### 4. Start the app

Use the start command you identified in step 1. Run it in the background and note its **PID**.

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
