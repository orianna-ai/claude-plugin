---
name: start-tunnel
description: Create an frpc tunnel to expose a local port through a Softlight tunnel URL. Requires a port with an application already listening. Returns the tunnel URL and frpc PID.
allowed-tools: Bash, Write
model: sonnet
---

# Start Tunnel

Create a tunnel to expose a local port. Follow these steps exactly in order.

## Step 1: Verify port

Run this command, replacing `$PORT` with the port number:

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT
```

If the status code is NOT between 200–399, STOP. Tell the user the port is not responding.

## Step 2: Create tunnel

```bash
curl -s -X POST http://localhost:8080/api/tunnels \
  -H 'Content-Type: application/json' \
  -d '{"platform":"'"$(uname -sm)"'","port":'"$PORT"'}'
```

The JSON response contains these fields — save all of them:
- `tunnel_url` — the public URL
- `tunnel_id` — unique ID
- `tunnel_config` — full frpc config text
- `tunnel_binary_url` — download URL for frpc
- `tunnel_binary_name` — name of the extracted directory

## Step 3: Write config file

Write `$tunnel_config` to `/tmp/frpc-$tunnel_id.toml`.

## Step 4: Download frpc (if needed)

Only download if `/tmp/$tunnel_binary_name/frpc` does not exist:

```bash
curl -sL $tunnel_binary_url | tar xz -C /tmp/
```

## Step 5: Start frpc

```bash
/tmp/$tunnel_binary_name/frpc -c /tmp/frpc-$tunnel_id.toml &
frpc_pid=$!
echo "$frpc_pid"
```

## Step 6: Verify tunnel

```bash
sleep 0.5
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$tunnel_url/")
  echo "Attempt $i: HTTP $CODE"
  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 400 ]; then
    echo "Tunnel is up"
    break
  fi
  sleep 0.5
done
```

If all 5 attempts fail, check frpc logs for errors.

## Output

Return exactly two values:
1. **Tunnel URL**: `$tunnel_url`
2. **FRPC PID**: `$frpc_pid`
