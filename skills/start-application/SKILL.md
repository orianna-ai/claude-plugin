---
name: start-application
description: >-
  Install dependencies, start a web application on a free port, and return the port, PID, and
  run command. Receives build & start info from code-analysis.
---

# Start Application

Start a web application on a free port using the build.

**Core principle: use the application's own start command.** Never write your own server scripts,
build scripts, or scaffolding. Never bypass the start command by running underlying binaries
directly — it often handles invisible setup.

You will receive the application that you are to start.

## Steps

### 1. Figure out the run command
Figure out the command to start the application. This is what developers run to start the app. Never write your own server scripts, build scripts, or scaffolding. Never bypass the start command by running underlying binaries directly — it often handles invisible setup.

### 2. Find a free port

You MUST find a free port to run the application. Always check available ports and find a free port.

Check which ports are in use with `ss -tlnp`.

Start at 50000 and increment until you find a free one.

### 3. Install dependencies

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
