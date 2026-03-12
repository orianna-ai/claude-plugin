---
name: start-tunnel
description: Create an frpc tunnel to expose a local port through a Softlight tunnel URL. Requires a port with an application already listening. Returns the tunnel URL and frpc PID.
---

# Start Tunnel

## Input

A local port `<port>` where an application is already listening.

## Steps

### 1. Verify the port is accessible

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:<port>
```

If not 2xx/3xx, fix the application first — do not proceed.

### 2. Create the tunnel

**First**, run `uname -sm` in the shell and capture the output (e.g. `Linux aarch64`, `Darwin arm64`).
Do NOT guess or hardcode the value — you must run the command.

**Then**, call the `create_tunnel` tool with `port` = `<port>` and `platform` = the exact output 
from the command above.

### 3. Write the config

Write `tunnel_config` from the tool response to `/tmp/frpc-<tunnel_id>.toml`.

### 4. Download frpc (if needed)

Skip if `/tmp/<tunnel_binary_name>/frpc` already exists. Otherwise:

```bash
curl -sL <tunnel_binary_url> | tar xz -C /tmp/
```

### 5. Start frpc

```bash
/tmp/<tunnel_binary_name>/frpc -c /tmp/frpc-<tunnel_id>.toml &
```

Note the **PID**.

### 6. Verify the tunnel is up

```bash
sleep 0.5

for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "<tunnel_url>/")
  echo "Attempt $i: HTTP $CODE"

  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 400 ]; then
    echo "Tunnel is up"
    break
  fi

  sleep 0.5
done
```

If all 5 attempts fail, check frpc logs for errors.

## Return

- `tunnel_url` from step 2
- frpc **PID** from step 5
