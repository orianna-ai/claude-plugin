---
name: start-application
description: >-
  Install dependencies, start a web application on a free port, and return the port, PID, and
  run command. Receives build & start info from code-analysis.
---

# Start Application

Start a web application on a free port using the build & start info from `code-analysis`.

**Core principle: use the application's own start command.** Never write your own server scripts,
build scripts, or scaffolding. Never bypass the start command by running underlying binaries
directly — it often handles invisible setup.

You will receive an **application analysis** that includes the install command, start command,
and how the app accepts a port. Use these directly.

## Steps

### 1. Find a free port

Check what's in use with `ss -tlnp`. Start at 8080 and increment until you find a free one.

### 2. Install dependencies

Run the install command from the analysis (e.g. `npm install`, `pip install -e .`). Skip if
already done (e.g. `node_modules` exists and lock file is unchanged).

### 3. Start and wait

Run the start command with the chosen port in the background. Note the **PID**. Poll until ready:

`sleep 3 && curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>`

2xx or 3xx means it's up. Keep polling — builds can take a few minutes.

### 4. Return

- The **port** it's listening on
- The application **PID**
- The **run command** used
