---
name: test-worktree-prototyping
description: >
  Test worktree-isolated parallel prototyping. Generates N design variants from a
  problem statement, launches parallel worktree agents that make code changes AND
  build/run/tunnel the app, then reports results.
model: sonnet
---

# Test Worktree Prototyping

Test that worktree-isolated parallel prototyping works end-to-end. Given a design problem
and an app directory, generate N design variants, then dispatch each to a background agent
running in its own git worktree. Each agent writes code, builds the app, creates a tunnel,
and adds it to the canvas — all in parallel.

## Inputs

The user must provide:

- **Design problem** —  In my billing app, the usages tab has some interesting data which is how much each user uses our service. I would love to filter by email domain which I can't today, so I can see the usages for everyone with the same email domain. Looking to design a solution to this.
- **App we are making changes to** — The billing service
- **N** — 2 variants
- **Project ID** — UUID of an existing Softlight project, passed by the user when starting the skill.

## Phase 1: Design Variants (Hardcoded)

Use these two variants — do not generate new ones:

**Variant 1:** Single-select dropdown domain filter above the usage table — A clean `<Select>` dropdown in a toolbar area above the AG Grid that lists all unique email domains extracted from the `account.owner` field in the usage data. Selecting a domain filters the grid client-side to show only that domain's accounts. Includes an "All domains" option to reset.

**Variant 2:** Multi-select domain chip filter with live counts above the usage table — An inline row of clickable chip/pill buttons above the AG Grid, one per unique email domain extracted from `account.owner`. Each chip shows the domain name and number of matching accounts. Multiple chips can be toggled simultaneously for cross-domain comparison. Active chips are styled with a filled accent color. A "Clear all" link resets the filter.

## Phase 2: Launch Worktree-Isolated Agents

### 2a. Assign free ports

Find N free ports starting from 50000:

```bash
ss -tlnp | grep -oP ':\K[0-9]+' | sort -n > /tmp/_used_ports.txt
PORT_1=50000; while grep -qx "$PORT_1" /tmp/_used_ports.txt; do PORT_1=$((PORT_1+1)); done
PORT_2=$((PORT_1+1)); while grep -qx "$PORT_2" /tmp/_used_ports.txt; do PORT_2=$((PORT_2+1)); done
echo "PORT_1=$PORT_1 PORT_2=$PORT_2"
```

### 2b. Launch agents

Launch all N agents **in parallel** as **background** agents, each with **worktree isolation**.
Send all Agent tool calls in a single message.

For each variant, use the Agent tool with these parameters:

- `description`: `"Variant {i} prototype"`
- `model`: `"sonnet"`
- `isolation`: `"worktree"`
- `run_in_background`: `true`
- `prompt`: The full prompt below, with `{variant_number}`, `{variant_description}`, `{port}`, and `{project_id}` substituted in.

### Agent Prompt Template

```
You are implementing a design variant in an isolated git worktree, then building and
running the app so it's accessible via a tunnel.

**CRITICAL: You are running in a git worktree. All file paths in Read, Edit, Write, and
Glob calls MUST be within your worktree directory, not the main repo's working directory.**

## Part 1: Implement the Design Change

1. Run `pwd` to get your worktree root. Use this as the base for ALL file paths.

2. Implement the following design change in the application source code in that worktree:

   **Variant {variant_number}:** {variant_description}

3. **Mock data:** Include realistic mock/seed data so the design change is populated and
   visible when the app loads. Do not leave the UI empty or waiting for real API responses —
   hardcode sample data that demonstrates the feature.

4. **Auto-navigate:** The app must automatically land on the page or state where the design
   change is visible when loaded at `/`. The user should see the change immediately with no
   clicks or navigation required. If the change is on a sub-page, update the default route
   or add a redirect so `/` shows it.

## Part 2: Build and Run the App

5. **Find the start command.** Read the `CLAUDE.md` file at the repo root and look for a
   section called **"Softlight Build Instructions"**. If it exists, look for a subsection
   matching the app. Use those instructions directly. If not found, explore the codebase to
   find the dev server start command.

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

10. **Add to canvas** — post an iframe slot:

    ```bash
    curl -s -X POST \
      "http://localhost:8080/api/projects/{project_id}/events" \
      -H "Content-Type: application/json" \
      -d "[{\"type\": \"slot_created\", \"slot\": {\"element\": {\"type\": \"iframe\", \"tunnel_id\": \"$TUNNEL_ID\", \"git_commit\": \"$GIT_COMMIT\", \"git_patch\": {\"url\": \"$PATCH_URL\"}}, \"width\": 1720, \"height\": 1120}}]"
    ```

11. **Return** the results in this exact format:
    ```
    WORKTREE_PATH=<output of pwd>
    TUNNEL_ID=<tunnel id>
    CHANGES_SUMMARY=<one paragraph describing what you changed and which files>
    ```
```

## Phase 3: Final Summary

After **all** agents complete, collect their outputs and print a final summary:

```
## Worktree Prototyping Results

Canvas: http://localhost:8080/projects/{project_id}

**Variant 1:** <variant description>
  tunnel_id: <tunnel_id>

**Variant 2:** <variant description>
  tunnel_id: <tunnel_id>
```

Tell the user they can view all variants side-by-side on the canvas. The design change should
be immediately visible with mock data — no navigation required.
