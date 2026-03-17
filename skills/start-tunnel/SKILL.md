---
name: start-tunnel
description: Create an frpc tunnel to expose a local port through a Softlight tunnel URL. Requires a port with an application already listening. Returns the tunnel URL and frpc PID.
allowed-tools: Bash
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

## Step 2: Setup tunnel

Generate a tunnel ID, determine the frpc binary for this platform, write the config file, and
download the binary:

```bash
TUNNEL_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
PLATFORM=$(uname -sm | tr '[:upper:]' '[:lower:]')
case "$PLATFORM" in
  "linux x86_64"|"linux amd64") FRPC_NAME=frp_0.61.1_linux_amd64 ;;
  "linux aarch64"|"linux arm64") FRPC_NAME=frp_0.61.1_linux_arm64 ;;
  "darwin x86_64"|"darwin amd64") FRPC_NAME=frp_0.61.1_darwin_amd64 ;;
  "darwin arm64"|"darwin aarch64") FRPC_NAME=frp_0.61.1_darwin_arm64 ;;
  *) echo "Unsupported platform: $PLATFORM" >&2; exit 1 ;;
esac
TUNNEL_URL="https://softlight.orianna.ai/api/tunnel/${TUNNEL_ID}/"
FRPC_URL="https://github.com/fatedier/frp/releases/download/v0.61.1/${FRPC_NAME}.tar.gz"

cat > /tmp/frpc-${TUNNEL_ID}.toml << EOF
serverAddr = "frp.orianna.ai"
serverPort = 443

[transport]
protocol = "wss"

[[proxies]]
name = "${TUNNEL_ID}"
type = "http"
localPort = ${PORT}
customDomains = ["frp-gateway.orianna.ai"]
httpUser = "${TUNNEL_ID}"
routeByHTTPUser = "${TUNNEL_ID}"
EOF

[ -f /tmp/${FRPC_NAME}/frpc ] || curl -sL "$FRPC_URL" | tar xz -C /tmp/
echo "TUNNEL_ID=$TUNNEL_ID TUNNEL_URL=$TUNNEL_URL FRPC_NAME=$FRPC_NAME"
```

Save the `TUNNEL_ID`, `TUNNEL_URL`, and `FRPC_NAME` from the output.

## Step 3: Start frpc

```bash
/tmp/$FRPC_NAME/frpc -c /tmp/frpc-$TUNNEL_ID.toml &
frpc_pid=$!
echo "$frpc_pid"
```

## Step 4: Verify tunnel

```bash
sleep 0.5
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$TUNNEL_URL/")
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
1. **Tunnel URL**: `$TUNNEL_URL`
2. **FRPC PID**: `$frpc_pid`
