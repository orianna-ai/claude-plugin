---
name: create-tunnel
description: Expose a local port via a Softlight tunnel URL. Use when an app is already listening on a port and you need a public https://softlight.orianna.ai/api/tunnel/<tunnel_id> URL for it (e.g. after start-application or for an existing server).
---

# Create Softlight Tunnel

Use this skill when something is already listening on a local port and you need a **Softlight tunnel URL** so the canvas (or other tools) can reach it.

## How it works

- The user opens **`https://softlight.orianna.ai/api/tunnel/<tunnel_id>/`**. Softlight’s server forwards the request to **`https://frp-gateway.orianna.ai/`** with header **`Authorization: Basic base64(tunnel_id:)`** (password empty).
- The **FRP server** at `frp-gateway.orianna.ai` routes by that Basic auth **username** to the **frpc** proxy that registered with the same value in **`routeByHTTPUser`** (and **`httpUser`**). The server supports multiple proxies on the same domain when each uses a distinct `routeByHTTPUser`.
- **frpc** runs on your machine: it connects to **frp.orianna.ai**, registers a proxy with `tunnel_id` as proxy name, `httpUser`, and **`routeByHTTPUser`**, and forwards to **`127.0.0.1:<port>`**.

So: **tunnel_id** = proxy name = HTTP auth user = **routeByHTTPUser**; they must match. The proxy **custom domain** must be **`frp-gateway.orianna.ai`**. **frpc** is often not on PATH; use the full path to the binary. Always use an **frpc config file** (with **`routeByHTTPUser`**) so multiple tunnels can run at once.

## Workflow

**Input:** A local port `<port>` where the app is listening.

0. **Precondition — port must be live.**  
   Run: `curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>`  
   If the result is not **200**, do not start the tunnel; fix or start the app first.

1. **Generate tunnel_id:**  
   `python3 -c "import uuid; print(uuid.uuid4())"`

2. **Resolve frpc binary** (if **FRPC_PATH** is set, use it; else `frpc` on PATH or full path e.g. from `find /tmp /usr/local -name frpc -type f 2>/dev/null`; prefer arch match: `aarch64`→`arm64`, `x86_64`→`amd64`). Reuse for other tunnels in the same session.

3. **Write a temporary config file** (e.g. `/tmp/frpc_<tunnel_id>.toml`) with this content (replace `<tunnel_id>` and `<port>`):

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

   **Start frpc** in the background: `frpc -c /path/to/frpc.toml` (use the path where you wrote the file).

   If you get "command not found", download from [frp releases](https://github.com/fatedier/frp/releases) (e.g. `frp_0.61.1_linux_arm64.tar.gz` for Linux arm64).

4. **Verify with bounded retries.**  
   Wait **3–5 seconds**, then:  
   `curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://softlight.orianna.ai/api/tunnel/<tunnel_id>/`  
   - If **200**: done.  
   - If 404 or connection error: wait **5 more seconds**, then run the same curl once.  
   - If still not 200: check the frpc process output. **"router config conflict"** → stop the other frpc and retry. **"subdomain and custom domains should not be both empty"** → ensure `customDomains = ["frp-gateway.orianna.ai"]` in the config file.

## Return

- **Tunnel URL:** `https://softlight.orianna.ai/api/tunnel/<tunnel_id>`
- **frpc PID** (capture when you start frpc in the background, for stop-application to tear down the tunnel)
