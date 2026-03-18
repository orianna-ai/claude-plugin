---
name: test-worktree-prototyping
description: >
  Test worktree-isolated parallel prototyping. Generates N design variants from a
  problem statement, launches parallel worktree agents for code changes, then sequentially
  runs each variant.
model: sonnet
---

# Test Worktree Prototyping

Test that worktree-isolated parallel prototyping works end-to-end. Given a design problem
and an app directory, generate N design variants, then dispatch each to a background agent
running in its own git worktree. Agents only write code. The orchestrator then sequentially
builds and runs each variant, creating tunnels as each becomes ready.

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

## Phase 2: Launch Worktree-Isolated Agents (Code Only)

**Assign ports before launching agents.** Use ports 50000, 50001, 50002, ... (one per variant).

Launch all N agents **in parallel** as **background** agents, each with **worktree isolation**.
Send all Agent tool calls in a single message.

**IMPORTANT: These agents ONLY write code, and MUST run in a git worktree and only work in that worktree**

For each variant, use the Agent tool with these parameters:

- `description`: `"Variant {i} prototype"`
- `model`: `"sonnet"`
- `isolation`: `"worktree"`
- `run_in_background`: `true`
- `prompt`: The full prompt below, with `{variant_number}`, `{variant_description}`substituted in.

### Agent Prompt Template

```
You are implementing a design variant in an isolated git worktree.

**CRITICAL: You are running in a git worktree. All file paths in Read, Edit, Write, and
Glob calls MUST be within your worktree directory, not the main repo's working directory.**

## Your Task

Implement the following design change in the application source code:

**Variant {variant_number}:** {variant_description}

## Instructions

1. Run `pwd` to get your worktree root. Use this as the base for ALL file paths. Implement the design change in the code in the worktree.

2. **Mock data:** Include realistic mock/seed data so the design change is populated and
   visible when the app loads. Do not leave the UI empty or waiting for real API responses —
   hardcode sample data that demonstrates the feature.

3. **Auto-navigate:** The app must automatically land on the page or state where the design
   change is visible when loaded at `/`. The user should see the change immediately with no
   clicks or navigation required. If the change is on a sub-page, update the default route
   or add a redirect so `/` shows it.

4. After making all changes, run `pwd` to confirm your working directory.

## IMPORTANT: Do NOT build or run the app

5. **Return** the results in this exact format:
   ```
   WORKTREE_PATH=<output of pwd>
   CHANGES_SUMMARY=<one paragraph describing what you changed and which files>
   ```
```

## Phase 3: Build and run WITHIN the worktree directory

When an agent finishes, follow the following steps with its output. But only process one variant at a time to avoid resource contention. If one is in progress, wait for it to finish before processing the next variant's output:

### Step 1: Start the app IN the worktree

**CRITICAL: Each Bash tool call starts a fresh shell — `cd` does not persist between calls.
Every command that must run in the worktree MUST be prefixed with `cd $WORKTREE_PATH &&`
in the same Bash call.**
```bash
# ✅ Always do this
cd $WORKTREE_PATH && <build/start command>

# ❌ Never do this — the cd is lost before the next call
cd $WORKTREE_PATH
<build/start command>   # runs in default directory
```

### Step 3: Poll until ready

Curl the app's health/root endpoint in a loop, up to 40 attempts, 3 seconds apart:

```bash
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ | grep -q "200"; then
    echo "Ready after $i attempts"
    break
  fi
  sleep 3
done
```

### Step 4: Create a tunnel

Expose the local port:

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
TUNNEL_URL="http://localhost:8080/api/tunnel/${TUNNEL_ID}/"

cat > /tmp/frpc-${TUNNEL_ID}.toml << EOF
serverAddr = "frp.orianna.ai"
serverPort = 443

[transport]
protocol = "wss"

[[proxies]]
name = "${TUNNEL_ID}"
type = "http"
localPort = {port}
customDomains = ["frp-gateway.orianna.ai"]
httpUser = "${TUNNEL_ID}"
routeByHTTPUser = "${TUNNEL_ID}"
EOF

[ -f /tmp/${FRPC_NAME}/frpc ] || curl -sL "https://github.com/fatedier/frp/releases/download/v0.61.1/${FRPC_NAME}.tar.gz" | tar xz -C /tmp/
```

Start frpc as a background process: `/tmp/$FRPC_NAME/frpc -c /tmp/frpc-$TUNNEL_ID.toml`
(use `run_in_background: true` with the Bash tool). Wait a few seconds, then verify the
tunnel is up by curling `$TUNNEL_URL`.

### Step 5: Add to canvas

Create an iframe slot pointing at the tunnel:

```bash
curl -s -X POST \
  "http://localhost:8080/api/projects/${PROJECT_ID}/events" \
  -H "Content-Type: application/json" \
  -d '[{"type": "slot_created", "slot": {"element": {"type": "iframe", "tunnel_id": "'"${TUNNEL_ID}"'"}, "width": 1720, "height": 1120}}]'
```

### Step 6: Report and continue

Report immediately — don't wait for other variants:
```
**Variant {i} ready:** <variant description>
  tunnel: <tunnel_url>
```

Then repeat Steps 1–6 for the next variant.

## Phase 4: Final Summary

After **all** variants are built, running, and tunneled, print a final summary:

```
## Worktree Prototyping Results

Canvas: http://localhost:8080/projects/{project_id}

**Variant 1:** <variant description>
  tunnel: <tunnel_url>

**Variant 2:** <variant description>
  tunnel: <tunnel_url>
```

Tell the user they can view all variants side-by-side on the canvas, or click individual
tunnel URLs to see each design variant live. The design change should be immediately visible
with mock data — no navigation required.
