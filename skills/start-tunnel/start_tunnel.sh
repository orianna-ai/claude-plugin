#!/usr/bin/env bash
set -euo pipefail

PORT="${1:?Usage: start_tunnel.sh <port>}"

# verify $PORT is accessible (try IPv4 first, then IPv6)
LOCAL_IP="127.0.0.1"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT" || true)
if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 400 ]] 2>/dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://[::1]:$PORT" || true)
  if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 400 ]] 2>/dev/null; then
    echo "ERROR: Port $PORT not reachable on 127.0.0.1 or ::1 (last HTTP $HTTP_CODE)" >&2
    exit 1
  fi
  LOCAL_IP="::1"
fi

# configure the script
FRPC_VERSION="0.67.0"
TUNNEL_ID="$(python3 -c "import uuid; print(uuid.uuid4())")"
PLATFORM="$(uname -sm)"

# locate the frpc binary
case "$PLATFORM" in
  "Linux x86_64")  BINARY_NAME="frp_${FRPC_VERSION}_linux_amd64" ;;
  "Linux aarch64") BINARY_NAME="frp_${FRPC_VERSION}_linux_arm64" ;;
  "Darwin x86_64") BINARY_NAME="frp_${FRPC_VERSION}_darwin_a dddmd64" ;;
  "Darwin arm64")  BINARY_NAME="frp_${FRPC_VERSION}_darwin_arm64" ;;
  *)
    echo "ERROR: Unsupported platform '$PLATFORM'. Run 'uname -sm' to verify." >&2
    exit 1
    ;;
esac

BINARY_URL="https://github.com/fatedier/frp/releases/download/v${FRPC_VERSION}/${BINARY_NAME}.tar.gz"

BINARY="/tmp/${BINARY_NAME}/frpc"

if [[ ! -x "$BINARY" ]]; then
  echo "Downloading frpc ($BINARY_NAME)..." >&2
  curl -sL "$BINARY_URL" | tar xz -C /tmp/
fi

# run frpc in the background and capture the pid
CONFIG_FILE="/tmp/frpc-${TUNNEL_ID}.toml"
PROXY_URL="${HTTPS_PROXY:-${HTTP_PROXY:-${https_proxy:-${http_proxy:-}}}}"

cat > "$CONFIG_FILE" <<TOML
serverAddr = "frp.orianna.ai"
serverPort = 443

[transport]
protocol = "wss"
${PROXY_URL:+proxyURL = \"${PROXY_URL}\"}

[[proxies]]
customDomains = ["frp-gateway.orianna.ai"]
hostHeaderRewrite = "localhost"
httpUser = "${TUNNEL_ID}"
localIP = "${LOCAL_IP}"
localPort = ${PORT}
name = "${TUNNEL_ID}"
routeByHTTPUser = "${TUNNEL_ID}"
type = "http"
TOML

"$BINARY" -c "$CONFIG_FILE" &>"/tmp/frpc-${TUNNEL_ID}.log" &
PID=$!

# verify the tunnel is accessible
sleep 0.5
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:8080/api/tunnel/$TUNNEL_ID/" || true)
  if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 400 ]] 2>/dev/null; then
    break
  fi
  if [[ $i -eq 5 ]]; then
    echo "ERROR: Tunnel did not come up after 5 attempts (last HTTP $HTTP_CODE)" >&2
    echo "frpc log:" >&2
    cat "/tmp/frpc-${TUNNEL_ID}.log" >&2
    exit 1
  fi
  sleep 0.5
done

# print the tunnel details
echo "TUNNEL_ID=${TUNNEL_ID}"
echo "PID=${PID}"
