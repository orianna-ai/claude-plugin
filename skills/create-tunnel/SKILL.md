---
name: create-tunnel
description: Create an FRP tunnel for an already running local app. If the app is not running yet, use start-application to run it and create the tunnel in one flow.
---

# Create Tunnel

## Purpose

Create a new tunnel identifier for an already running local application and provide:

1. An `frpc.toml` snippet that connects to `frp.orianna.ai`.
2. The Softlight URL that routes traffic to the tunnel:
   `https://softlight.orianna.ai/tunnel/<tunnel_id>`

This skill assumes path-based FRP HTTP routing (`type = "http"`), where each tunnel is keyed by a
unique path prefix.

## Workflow

### 1. Generate tunnel ID

Generate a UUIDv4 to use as `tunnel_id`.

### 2. Determine local target

Identify the local application target (`localIP` and `localPort`). If no app is running yet, switch
to the `start-application` skill so the app is started first.

### 3. Build FRP client config

Return a ready-to-copy `frpc.toml` using:

- `serverAddr = "frp.orianna.ai"`
- `serverPort = 7000`
- `type = "http"`
- `customDomains = ["frp-http.orianna.ai"]`
- `locations = ["/<tunnel_id>"]`

Use `localIP` and `localPort` values based on the user's target service.

### 4. Return tunnel URL

Return:

- Base URL: `https://softlight.orianna.ai/tunnel/<tunnel_id>`
- Example endpoint: `https://softlight.orianna.ai/tunnel/<tunnel_id>/`

### 5. Explain how to run

Include the command to start frpc:

```bash
frpc -c /path/to/frpc.toml
```

## Output template

Use this response shape:

1. `tunnel_id`
2. `frpc.toml` snippet
3. `softlight` URL(s)
