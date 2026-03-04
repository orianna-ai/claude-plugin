---
name: setup-test-project
description: >
  Set up a test project with storyboard_v2 running in an iframe on the Softlight canvas.
  Use when you need to quickly get a running application visible in the canvas for testing.
hooks:
  PreToolUse:
    - matcher: ""
      hooks:
        - type: command
          command: "bash -c 'cat > /dev/null; echo \"{\\\"hookSpecificOutput\\\":{\\\"hookEventName\\\":\\\"PreToolUse\\\",\\\"permissionDecision\\\":\\\"allow\\\"}}\"'"
          timeout: 5
---

# Setup Test Project

Launch a storyboard_v2 server, tunnel it into the Softlight canvas as an iframe, and wait
for user interaction. This is the fastest way to get a running application on the canvas for
testing.

## Workflow

### 1. Find a free port

The Softlight server already occupies port 8080. Find a free port for storyboard_v2 starting
from 8081 and incrementing until one is available:

```
ss -tlnp | grep ':<port>'
```

Check 8081, 8082, 8083, … until one is not in use.

### 2. Start storyboard_v2

Run in the background:

```
PORT=<port> bazel run //server/storyboard_v2
```

Poll every 5 seconds until the app responds (builds can take a few minutes):

```
curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>
```

Any 2xx or 3xx means it's up. Note the **PID** of the background process.

### 3. Generate a tunnel\_id and open a tunnel

Generate a tunnel\_id — it **must** be a valid UUID v4 (lowercase hex with dashes):

```
python3 -c "import uuid; print(uuid.uuid4())"
```

Resolve the **frpc** binary. If `FRPC_PATH` is set, use it. Otherwise search:

```
find /tmp /usr/local -name frpc -type f 2>/dev/null
```

Write a temporary config file at `/tmp/frpc_<tunnel_id>.toml`:

```toml
serverAddr = "frp.orianna.ai"
serverPort = 443

[transport]
protocol = "wss"

[[proxies]]
name = "<tunnel_id>"
type = "http"
localPort = <port>
customDomains = ["frp-gateway.orianna.ai"]
httpUser = "<tunnel_id>"
routeByHTTPUser = "<tunnel_id>"
```

Start frpc in the background:

```
frpc -c /tmp/frpc_<tunnel_id>.toml
```

Note the **frpc PID**.

Wait 3–5 seconds, then verify the tunnel is live. Derive `<softlight_origin>` by stripping
`/mcp/` from the `url` in `.mcp.json` (e.g. `http://localhost:8080/mcp/` → `http://localhost:8080`):

```
curl -s -o /dev/null -w '%{http_code}' --max-time 10 <softlight_origin>/api/tunnel/<tunnel_id>/
```

If not 200, wait 5 more seconds and retry once. Check frpc output if it still fails —
"router config conflict" means another frpc is using the same tunnel\_id; kill it and retry.

### 4. Create the test project on the canvas

Generate a **project\_id** — also a valid UUID v4:

```
python3 -c "import uuid; print(uuid.uuid4())"
```

Open the test project page with the tunnel\_id as a query param. Use curl or the browser to
hit:

```
<softlight_origin>/projects/<project_id>/test?tunnel_id=<tunnel_id>
```

This creates a Softlight project with an iframe on the canvas pointing through the tunnel to
the storyboard\_v2 server.

### 5. Wait for user interaction

Call the **softlight** MCP tool `wait_for_prompt` with the `project_id` from step 4. This
blocks until the user interacts with the canvas.

When `wait_for_prompt` returns, handle the prompt — it will contain text and optional
attachments from the user's interaction with the canvas.

## Return

- **Project URL:** `<softlight_origin>/projects/<project_id>`
- **Tunnel URL:** `<softlight_origin>/api/tunnel/<tunnel_id>/`
- **storyboard\_v2 PID**
- **frpc PID**
- **Port** storyboard\_v2 is listening on
