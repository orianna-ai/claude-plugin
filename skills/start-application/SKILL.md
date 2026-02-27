---
name: start-application
description: Start an application server and create an FRP tunnel, returning the tunnel URL. Use when the user wants to run, launch, or access an app through Softlight.
---

# Start Application + Create Tunnel

## Workflow

### 1. Run the application on its own port

Examine the project to determine the correct run command. Check for:

Makefile / Justfile (e.g. make run, just serve)
package.json scripts (e.g. npm run dev)
docker-compose.yml services
Build system targets (bazel run, gradle run, cargo run, etc.)
Direct entry points (python __main__.py, go run ., etc.)
README.md or CONTRIBUTING.md for documented run instructions

Most servers accept a port via the PORT environment variable, but check the application's configuration to confirm.

When running multiple applications simultaneously each must use a unique port. Scan running
terminals for processes already listening on a port. Assign ports starting from `8080` and increment
by one for each additional application. Never reuse a port that is already in use.

Run the application in the background using `block_until_ms: 0` so the command runs immediately
without blocking. Build steps may take a while before the server actually starts listening.

### 2. Verify startup

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

### 3. Create and start the tunnel

After the application is confirmed healthy, create and start an FRP tunnel so the application is
accessible via a Softlight tunnel URL. This step is **mandatory** — never skip it.

1. Generate a UUIDv4 as `tunnel_id`.
2. Start `frpc` directly in the background using CLI arguments (no config file needed):

```bash
frpc http -s frp.orianna.ai -P 443 -p wss -n <tunnel_id> -i 127.0.0.1 -l <detected_port> --http-user <tunnel_id>
```

   The FRP server routes tunnels by HTTP basic auth user. The Softlight server proxies requests
   from `/api/tunnel/{tunnel_id}/{path}` to `https://frp-gateway.orianna.ai/{path}` with an
   `Authorization: Basic <base64(tunnel_id:)>` header, which the FRP server matches against the
   proxy's `--http-user`.

   Run this with `block_until_ms: 0` so it runs in the background. `frpc` must keep running for the
   tunnel to stay open.

4. Verify the tunnel is up by polling the tunnel URL with `curl`:

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://softlight.orianna.ai/api/tunnel/<tunnel_id>/
```

   Use the same exponential backoff strategy as step 6 (wait 5s, 10s, 20s between checks). If the
   tunnel doesn't come up after all retries, report the error but don't tear down the application.

### 4. Return metadata

Return:

- Tunnel URL: `https://softlight.orianna.ai/api/tunnel/<tunnel_id>`
- Which application is running
- Which port it's on
- The terminal ID and PID (so `stop-application` can tear it down later)
- The `frpc` PID (so `stop-application` can tear down the tunnel too)
