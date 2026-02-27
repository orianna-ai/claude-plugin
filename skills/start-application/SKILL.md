---
name: start-application
description: Start an application server and create an FRP tunnel, returning the tunnel URL. Use when the user wants to run, launch, or access an app through Softlight.
---

# Start Application + Create Tunnel

## Workflow

### 1. Run the application on a free port

- Find the run command (Makefile, package.json, `bazel run`, `docker compose`, etc.). Prefer **PORT** env var for the port (e.g. `PORT=8082`).
- Pick a port not in use (e.g. `ss -tlnp` or `lsof -i :8080`). Use 8080, 8081, 8082, … and increment if needed.
- Run the app in the background and **note its PID** (for stop-application). Wait for a clear “listening” / “started” message, then confirm with:
  `curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>`
  Expect 200.

### 2. Create the tunnel

Use the **create-tunnel** skill with the port from step 1. It will start frpc and return the Softlight tunnel URL and the frpc PID.

### 3. Return

- **Tunnel URL** (from create-tunnel): `https://softlight.orianna.ai/api/tunnel/<tunnel_id>`
- Which application is running and on which port
- Terminal/PID for the app (for stop-application)
- **frpc** PID (from create-tunnel, for stop-application to tear down the tunnel)
