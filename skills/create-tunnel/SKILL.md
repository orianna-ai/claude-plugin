---
name: create-tunnel
description: Expose a local port via a Softlight tunnel URL. Use when an app is already listening on a port and you need a public https://softlight.orianna.ai/api/tunnel/<tunnel_id> URL for it (e.g. after start-application or for an existing server).
---

# Create Softlight Tunnel

Use this skill when something is already listening on a local port and you need a **Softlight tunnel URL** so the canvas (or other tools) can reach it.

## How it works

- The user opens **`https://softlight.orianna.ai/api/tunnel/<tunnel_id>/`**. Softlight’s server forwards the request to **`https://frp-gateway.orianna.ai/`** with header **`Authorization: Basic base64(tunnel_id:)`** (password empty).
- The **FRP server** at `frp-gateway.orianna.ai` routes by that Basic auth **username** to the **frpc** proxy that registered with **`--http-user <tunnel_id>`**.
- **frpc** runs on your machine: it connects to **frp.orianna.ai**, registers a proxy with that `tunnel_id` as proxy name and HTTP user, and forwards to **`127.0.0.1:<port>`**.

So: **tunnel_id** = proxy name = HTTP auth user; they must match. The proxy **custom domain** must be **`frp-gateway.orianna.ai`** (subdomain is not enabled). **frpc** is often not on PATH; use the full path to the binary.

## Workflow

**Input:** A local port `<port>` where the app is listening.

0. **Precondition — port must be live.**  
   Run: `curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>`  
   If the result is not **200**, do not start the tunnel; fix or start the app first.

1. **Stop any existing frpc** so only one proxy uses the gateway.  
   Run: `pkill -f frpc` (or kill the specific frpc PID if replacing one tunnel). Only one frpc proxy using `frp-gateway.orianna.ai` can be active at a time ("router config conflict" otherwise).  
   Wait 1–2 seconds after killing before starting the new frpc.

2. **Generate tunnel_id:**  
   `python3 -c "import uuid; print(uuid.uuid4())"`

3. **Resolve frpc binary**, then start it in the background.
   - If **FRPC_PATH** is set in the environment, use `$FRPC_PATH`.
   - Else if `frpc` is on PATH, use `frpc`; otherwise use the **full path** to a binary (e.g. `/tmp/frp_0.61.1_linux_arm64/frpc`).
   - To find a binary: `find /tmp /usr/local -name frpc -type f 2>/dev/null`. Prefer one matching your arch (e.g. `uname -m` → `aarch64` → path containing `arm64`; `x86_64` → `amd64`). Reuse this path for other tunnels in the same session.

   **Command** (replace `/path/to/frpc`, `<tunnel_id>`, `<port>`):

```bash
/path/to/frpc http -s frp.orianna.ai -P 443 -p wss -n <tunnel_id> -i 127.0.0.1 -l <port> --http-user <tunnel_id> -d frp-gateway.orianna.ai
```

   - **-n** = proxy name = **tunnel_id**
   - **--http-user** = **tunnel_id** (Softlight sends this in Basic auth)
   - **-d** = **frp-gateway.orianna.ai** (subdomain not supported)
   - **-l** = local **port**

   If you get "command not found", download from [frp releases](https://github.com/fatedier/frp/releases) (e.g. `frp_0.61.1_linux_arm64.tar.gz` for Linux arm64, then run the `frpc` inside the tarball).

4. **Verify with bounded retries.**  
   Wait **3–5 seconds**, then:  
   `curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://softlight.orianna.ai/api/tunnel/<tunnel_id>/`  
   - If **200**: done.  
   - If 404 or connection error: wait **5 more seconds**, then run the same curl once.  
   - If still not 200: check the frpc process output. **"router config conflict"** → stop the other frpc (or a previous run) and retry from step 1. **"subdomain and custom domains should not be both empty"** → ensure the command includes `-d frp-gateway.orianna.ai`.

## Return

- **Tunnel URL:** `https://softlight.orianna.ai/api/tunnel/<tunnel_id>`
- **frpc PID** (capture when you start frpc in the background, for stop-application to tear down the tunnel)
