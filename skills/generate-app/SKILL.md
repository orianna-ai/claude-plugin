---
name: generate-app
description: >
  Agent prompt template for building an app prototype in a worktree. Implements a design variant,
  builds and runs the app, creates a tunnel, updates the canvas slot, and marks the prompt done.
model: sonnet
---

# Generate App

You are implementing a design variant in an isolated git worktree, then building and
running the app so it's accessible via a tunnel. Lastly, you update the slots in the project and return.

**CRITICAL: You are running in a git worktree. All file paths in Read, Edit, Write, and
Glob calls MUST be within your worktree directory, not the main repo's working directory.**

## Agent Prompt Template

The following template variables must be substituted by the caller:

- `{title}` — Short display label for the design variant
- `{variant_description}` — Detailed description of the design change
- `{port}` — Assigned port number for this variant's dev server
- `{project_id}` — Softlight project UUID
- `{slot_id}` — Placeholder slot UUID to replace with the live iframe
- `{prompt_id}` — Prompt event UUID to mark as completed

```
You are implementing a design variant in an isolated git worktree, then building and
running the app so it's accessible via a tunnel.

**CRITICAL: You are running in a git worktree. All file paths in Read, Edit, Write, and
Glob calls MUST be within your worktree directory, not the main repo's working directory.**

## Part 1: Implement the Design Change

1. Run `pwd` to get your worktree root. Use this as the base for ALL file paths.

2. Implement the following design change in the application source code in that worktree:

   **{title}:** {variant_description}

3. **Mock data:** Include realistic mock/seed data so the design change is populated and
   visible when the app loads. Do not leave the UI empty or waiting for real API responses —
   hardcode sample data that demonstrates the feature.

4. **Auto-navigate:** The app must automatically land on the page and state of that page where the design change is visible immediately when loaded at `/`. The user should see the change immediately with no clicks or navigation required when they hit `/`.

## Part 2: Build and Run the App

5. **Find the start command.** Find the command to start the application.

6. **Start the app** on port **{port}** as a background process (`&`). Save the PID.

7. **Capture the git commit and patch** while the app builds:

   ```bash
   GIT_COMMIT=$(git rev-parse HEAD)
   PATCH_URL=$(git add -N . && git diff HEAD | curl -sF 'file=@-;type=text/x-diff' https://drive.orianna.ai/api/v2/upload)
   ```

8. **Poll for app readiness** (up to 40 attempts, 3 seconds apart). Try both IPv4 and IPv6
   since some dev servers only bind to `::1`:

   ```bash
   for i in $(seq 1 40); do
     CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:{port}/" 2>/dev/null || true)
     if [[ "$CODE" -ge 200 && "$CODE" -lt 400 ]] 2>/dev/null; then echo "Ready (IPv4) after $i attempts"; break; fi
     CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://[::1]:{port}/" 2>/dev/null || true)
     if [[ "$CODE" -ge 200 && "$CODE" -lt 400 ]] 2>/dev/null; then echo "Ready (IPv6) after $i attempts"; break; fi
     sleep 3
   done
   ```

9. **Start the tunnel.** Run this entire block — it downloads frpc if needed, starts the
   tunnel, and verifies it's up:

   ```bash
   TUNNEL_ID="$(python3 -c "import uuid; print(uuid.uuid4())")"
   FRPC_VERSION="0.67.0"
   case "$(uname -sm)" in
     "Linux x86_64")  FRPC_BIN="frp_${FRPC_VERSION}_linux_amd64" ;;
     "Linux aarch64") FRPC_BIN="frp_${FRPC_VERSION}_linux_arm64" ;;
     "Darwin x86_64") FRPC_BIN="frp_${FRPC_VERSION}_darwin_amd64" ;;
     "Darwin arm64")  FRPC_BIN="frp_${FRPC_VERSION}_darwin_arm64" ;;
   esac
   [ -x "/tmp/$FRPC_BIN/frpc" ] || curl -sL "https://github.com/fatedier/frp/releases/download/v${FRPC_VERSION}/${FRPC_BIN}.tar.gz" | tar xz -C /tmp/
   PROXY_URL="${HTTPS_PROXY:-${HTTP_PROXY:-${https_proxy:-${http_proxy:-}}}}"
   cat > "/tmp/frpc-${TUNNEL_ID}.toml" <<TOML
   serverAddr = "frp.orianna.ai"
   serverPort = 443
   [transport]
   protocol = "wss"
   ${PROXY_URL:+proxyURL = \"${PROXY_URL}\"}
   [[proxies]]
   customDomains = ["frp-gateway.orianna.ai"]
   hostHeaderRewrite = "localhost"
   httpUser = "${TUNNEL_ID}"
   localPort = {port}
   name = "${TUNNEL_ID}"
   routeByHTTPUser = "${TUNNEL_ID}"
   type = "http"
   TOML
   /tmp/$FRPC_BIN/frpc -c /tmp/frpc-${TUNNEL_ID}.toml &>/tmp/frpc-${TUNNEL_ID}.log &
   sleep 1
   for i in 1 2 3 4 5; do
     CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:8080/api/tunnel/$TUNNEL_ID/" || true)
     [[ "$CODE" -ge 200 && "$CODE" -lt 400 ]] 2>/dev/null && break
     sleep 1
   done
   echo "TUNNEL_ID=$TUNNEL_ID"
   ```

10. **Update the placeholder slot** with the live iframe:

    ```bash
    curl -s -X POST \
      "http://localhost:8080/api/projects/{project_id}/events" \
      -H "Content-Type: application/json" \
      -d "[{\"type\": \"slot_updated\", \"slot_id\": \"{slot_id}\", \"element\": {\"type\": \"iframe\", \"tunnel_id\": \"$TUNNEL_ID\", \"git_commit\": \"$GIT_COMMIT\", \"git_patch\": {\"url\": \"$PATCH_URL\"}}}]"
    ```

11. **Mark the prompt as done:**

    ```bash
    curl -s -X POST \
      "http://localhost:8080/api/projects/{project_id}/events" \
      -H "Content-Type: application/json" \
      -d '[{"type": "prompt_completed", "prompt_id": "{prompt_id}"}]'
    ```

12. **Return** the results in this exact format:
    ```
    WORKTREE_PATH=<output of pwd>
    TUNNEL_ID=<tunnel id>
    CHANGES_SUMMARY=<one paragraph describing what you changed and which files>
    ```
```
