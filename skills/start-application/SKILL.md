---
name: start-application
description: Start an application server and create an FRP tunnel, returning the tunnel URL. Use when the user wants to run, launch, or access an app through Softlight.
---

# Start Application + Create Tunnel

Your task is to start the application and create a tunnel. It is ok if multiple of the same app are running in parallel. That is intended. Don't waste time reasoning about that, it is supposed to happen.

## Workflow

### 1. Run the application on a free port

**⚠️ You may be running in an isolated worktree. ALL commands must run from your current working directory.**
- **NEVER** `cd` to a different directory before running commands. This breaks worktree isolation.
- Use relative paths for everything.
- Find the run command (Makefile, package.json, or build tool). Prefer **PORT** env var for the port.
- Pick a port not in use (e.g. `ss -tlnp` or `lsof -i :8080`). Use 8080, 8081, 8082, … and increment if needed.
- Run the app in the background and **note its PID** (for stop-application).
- Poll every 10 seconds until the app responds (builds can take a few minutes):
  `sleep 10 && curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>`
  Expect 200. Do not use long sleeps — check every 10-20s so you proceed as soon as it's ready.

### 2. Create the tunnel

Use the **create-tunnel** skill with the port from step 1. It will start frpc and return the Softlight tunnel URL and the frpc PID.

### 3. Return

- **Tunnel URL** (from create-tunnel): `https://softlight.orianna.ai/api/tunnel/<tunnel_id>`
- Which application is running and on which port
- Terminal/PID for the app (for stop-application)
- **frpc** PID (from create-tunnel, for stop-application to tear down the tunnel)
