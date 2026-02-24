---
name: start-application
description: Start an application server, then create an FRP tunnel and return a Softlight tunnel URL. Use when the user wants to run, launch, or access an app through Softlight.
---

# Start Application + Create Tunnel

## Workflow

### 1. Identify the application

Figure out which application the user wants to run. If ambiguous, explore the project structure to
find runnable applications (look for entry points like `__main__.py`, `main.py`, `app.py`,
`package.json` scripts, `Makefile` targets, `docker-compose.yml` services, etc.) and ask the user to
pick one.

### 2. Figure out how to run it

Examine the project to determine the correct run command. Check for:

- `Makefile` / `Justfile` (e.g. `make run`, `just serve`)
- `package.json` scripts (e.g. `npm run dev`)
- `docker-compose.yml` services
- Build system targets (`bazel run`, `gradle run`, `cargo run`, etc.)
- Direct entry points (`python __main__.py`, `go run .`, etc.)
- `README.md` or `CONTRIBUTING.md` for documented run instructions

Most servers accept a port via the `PORT` environment variable, but check the application's
configuration to confirm.

### 3. Pick a port

When running multiple applications simultaneously each must use a unique port. Scan running
terminals for processes already listening on a port. Assign ports starting from `8080` and increment
by one for each additional application. Never reuse a port that is already in use.

### 4. Check for environment variables

Some applications require environment variables (e.g. `REDIS_URL`, `DATABASE_URL`). Look for
settings or configuration files that declare required variables. Warn the user if required variables
appear to be missing, but don't block startup -- the app will fail with a clear error if they're
truly required.

### 5. Start the application

Run the application in the background using `block_until_ms: 0` so the command runs immediately
without blocking. Build steps may take a while before the server actually starts listening.

### 6. Verify startup

Poll the terminal output to confirm the server started successfully. Look for common startup
messages (e.g. `Listening on`, `Uvicorn running on`, `Server started`, `ready on`). Use exponential
backoff: wait 10s, 20s, 40s between checks. Build steps can take over a minute before the server
starts.

After the terminal shows a startup message, probe the URL with `curl` to confirm the server is
actually accepting connections:

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>
```

If the probe fails, keep polling — the server may still be warming up.

Once running, record the local app URL (for example, `http://localhost:<port>`).

### 7. Create the tunnel

After the application is confirmed healthy, generate a UUIDv4 as `tunnel_id` and return an
`frpc.toml` snippet that forwards the running application through FRP:

- `serverAddr = "frp.orianna.ai"`
- `serverPort = 7000`
- `type = "http"`
- `customDomains = ["frp-gateway.orianna.ai"]`
- `locations = ["/<tunnel_id>"]`
- `localIP = "127.0.0.1"`
- `localPort = <detected_port>`

### 8. Return the Softlight tunnel URL and run instructions

Return:

- Base URL: `https://softlight.orianna.ai/tunnel/<tunnel_id>`
- Example endpoint: `https://softlight.orianna.ai/tunnel/<tunnel_id>/`
- `frpc` run command:

```bash
frpc -c /path/to/frpc.toml
```

Also include:

- Which application is running
- Which port it's on
- The terminal ID and PID (so `stop-application` can tear it down later)
