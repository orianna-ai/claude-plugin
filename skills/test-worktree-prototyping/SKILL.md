---
name: test-worktree-prototyping
description: >
  Test worktree-isolated parallel prototyping. Generates N design variants from a
  problem statement, then launches parallel worktree agents that each implement a variant,
  build and run the app, and create a tunnel — all end-to-end in a single agent per variant.
model: sonnet
---

# Test Worktree Prototyping

Test that worktree-isolated parallel prototyping works end-to-end. Given a design problem
and an app directory, generate N design variants, then dispatch each to a background agent
running in its own git worktree. Each agent makes real source code changes, builds, runs,
and tunnels the app so results are immediately viewable — no separate build phase needed.

## Inputs

The user must provide:

- **Design problem** —  In my billing app, the usages tab has some interesting data which is how much each user uses our service. I would love to filter by email domain which I can't today, so I can see the usages for everyone with the same email domain. Looking to design a solution to this.
- **App we are making changes to** — The billing service
- **N** — 3 variants (optional, default 2)

## Phase 1: Generate 3 Design Variants

Before launching any agents, generate N distinct design variant descriptions from the user's
design problem. Each variant should be a meaningfully different approach to solving the same
problem.

For example, if the design problem is "redesign the navigation bar":
- Variant 1: "Horizontal top nav with dropdown menus, a prominent search bar, and breadcrumb trail"
- Variant 2: "Collapsible sidebar navigation with icon-based categories and a floating action button"

Output the variants so the user can see what will be implemented:

```
## Design Variants

**Variant 1:** <description>
**Variant 2:** <description>
**Variant 3:** <description>

```

## Phase 2: Launch Worktree-Isolated Agents

**Assign ports before launching agents.** Use ports 50000, 50001, 50002, ... (one per variant).
This avoids race conditions where parallel agents compete for the same port.

Launch all N agents **in parallel** as **background** agents, each with **worktree isolation**.
Send all Agent tool calls in a single message.

For each variant, use the Agent tool with these parameters:

- `description`: `"Variant {i} prototype"`
- `model`: `"sonnet"`
- `isolation`: `"worktree"`
- `run_in_background`: `true`
- `prompt`: The full prompt below, with `{variant_number}`, `{variant_description}`, `{app_directory}`, and `{port}` substituted in.

### Agent Prompt Template

Pass this prompt to each agent (substitute `{variant_number}`, `{variant_description}`,
`{app_directory}`, and `{port}`):

```
You are implementing a design variant in an isolated git worktree.

**CRITICAL: You are running in a git worktree. All file paths in Read, Edit, Write, and
Glob calls MUST be within your worktree directory, not the main repo's working directory.**

## Your Task

Implement the following design change in the application source code:

**Variant {variant_number}:** {variant_description}

## Instructions

1. Run `pwd` to get your worktree root. Use this as the base for ALL file paths.

2. You are making the design changes to the app at  `{app_directory}` directory (relative to your worktree root). Implement the design variant by modifying the code.

3. **Mock data:** Include realistic mock/seed data so the design change is populated and
   visible when the app loads. Do not leave the UI empty or waiting for real API responses —
   hardcode sample data that demonstrates the feature.

4. **Auto-navigate:** The app must automatically land on the page or state where the design
   change is visible when loaded at `/`. The user should see the change immediately with no
   clicks or navigation required. If the change is on a sub-page, update the default route
   or add a redirect so `/` shows it.

5. After making all changes, run `pwd` to confirm your working directory (this is your
   worktree path) and run `git branch --show-current` to get your branch name.

## Build, Run, and Tunnel

Now that your code changes are complete, build and expose the app.

6. Your assigned port is **{port}**. Use this port — do not scan for a free port.

7. **Start the app** as a background process on that port using the appropriate start
   command for the `{app_directory}` application. Use `run_in_background: true` with the
   Bash tool. The start command should be run from the worktree root directory.

8. **Poll until ready** — curl the app's health/root endpoint in a loop, up to 40 attempts,
   3 seconds apart:
   ```bash
   for i in $(seq 1 40); do
     if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ | grep -q "200"; then
       echo "Ready after $i attempts"
       break
     fi
     sleep 3
   done
   ```

9. **Create a tunnel** to expose the local port:
   - Generate a UUID for the tunnel name: `TUNNEL_ID=$(uuidgen)`
   - Write an frpc config file at `/tmp/frpc-$TUNNEL_ID.toml`:
     ```toml
     serverAddr = "tunnel.softlight.dev"
     serverPort = 7000
     auth.method = "token"
     auth.token = "tun_RkC9VLpz4xQmNdKw"

     [[proxies]]
     name = "$TUNNEL_ID"
     type = "http"
     localPort = $PORT
     customDomains = ["$TUNNEL_ID.tunnel.softlight.dev"]
     ```
   - Download frpc if not already present:
     ```bash
     if [ ! -f /tmp/frpc ]; then
       curl -sL https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_linux_amd64.tar.gz | tar xz -C /tmp
       mv /tmp/frp_0.61.1_linux_amd64/frpc /tmp/frpc
       chmod +x /tmp/frpc
     fi
     ```
   - Start frpc as a background process: `/tmp/frpc -c /tmp/frpc-$TUNNEL_ID.toml`
     (use `run_in_background: true` with the Bash tool)
   - Wait a few seconds, then verify the tunnel is up by curling the tunnel URL.

10. **Return** the results in this exact format:
   ```
   WORKTREE_PATH=<output of pwd>
   BRANCH=<output of git branch --show-current>
   CHANGES_SUMMARY=<one paragraph describing what you changed and which files>
   PORT=<port number>
   TUNNEL_URL=https://<TUNNEL_ID>.tunnel.softlight.dev
   FRPC_PID=<pid of the frpc process>
   ```
```

## Phase 3: Stream Results

Do **not** wait for all agents to finish before reporting. As each agent completes, immediately
print its result:

```
**Variant {i} ready:** <variant description>
  tunnel: <tunnel_url>
```

After **all** agents have completed, print a final summary with all tunnel URLs together:

```
## Worktree Prototyping Results

**Variant 1:** <variant description>
  tunnel: <tunnel_url>

**Variant 2:** <variant description>
  tunnel: <tunnel_url>

**Variant 3:** <variant description>
  tunnel: <tunnel_url>
```

Tell the user they can click each tunnel URL to see the design variant live. The design change
should be immediately visible with mock data — no navigation required.
