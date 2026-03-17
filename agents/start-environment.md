---
name: start-environment
description: "Start a web app's dev server and create a tunnel, with tunnel prep overlapping the app build. Returns the port, tunnel URL, PIDs, and start command."
model: sonnet
---

# Start Environment

Start the application and create a tunnel to expose it. Tunnel preparation runs while the app
builds so the two overlap — do not wait for the app to be ready before prepping the tunnel.

## Step 1: Check for saved build instructions

Read the `CLAUDE.md` file at the project root and look for a section called
**"Softlight Build Instructions"**. If it exists, look for a subsection that matches the app you
have been asked to start.

If you find matching build instructions, use them directly — **skip all codebase exploration** and
go straight to Step 2.

If there is no "Softlight Build Instructions" section, or the section does not contain instructions
for the app you need, proceed to Step 1b.

## Step 1b: Explore the codebase (only if no saved instructions)

Find the app that you are meant to start. You may be operating in a monorepo, so find the right
app.

Find the command used to run the dev server for the application you are to start. It is essential
you start that application, and not another one if you are in a monorepo.

Use the Glob and Grep tools to find the command used to start the server. You are looking for the
command a developer would use to run the application locally. It's often mentioned in build files
(`package.json`, `Makefile`, `BUILD.bazel`, `pyproject.toml`, etc.) or in documentation.

We care about running the application once and that the application starts fast. If there are
multiple potential commands, pick the one that best fits to get it started the fastest.

## Step 2: Find a free port

You MUST find a free port to run the application. Always check available ports and find a free
port. Start from 50000 and increment by 1 until you find a free port.

```bash
ss -tlnp | grep -oP ':\K[0-9]+' | sort -n > /tmp/_used_ports.txt
PORT=50000; while grep -qx "$PORT" /tmp/_used_ports.txt; do PORT=$((PORT+1)); done; echo "$PORT"
```

## Step 3: Start the app (do NOT poll yet)

Run the start command with the chosen port as a background process (`&`). Save the PID.

Do **not** poll for readiness yet — move to step 4 immediately so tunnel prep overlaps with the
app build.

## Step 4: Prep the tunnel (while app builds)

While the app is building in the background, prepare the tunnel:

**4a.** Get the platform:

```bash
uname -sm
```

**4b.** Call the `mcp__plugin_softlight_softlight__create_tunnel` tool with:
- `port`: the port number (integer)
- `platform`: the output from `uname -sm`

Save all fields from the response: `tunnel_url`, `tunnel_id`, `tunnel_config`,
`tunnel_binary_url`, `tunnel_binary_name`.

**4c.** Write the config and download the frpc binary in one command. Substitute the actual values
from the `create_tunnel` response:

```bash
cat <<'FRPC_EOF' > /tmp/frpc-$TUNNEL_ID.toml
$TUNNEL_CONFIG
FRPC_EOF
[ -f /tmp/$TUNNEL_BINARY_NAME/frpc ] || curl -sL "$TUNNEL_BINARY_URL" | tar xz -C /tmp/
```

## Step 5: Poll for app readiness

Now check whether the app is ready. It may already be up if the build was fast.

```bash
for i in $(seq 1 40); do
  kill -0 $PID 2>/dev/null || { echo "Process exited"; exit 1; }
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT | grep -qE '^[23]' && break
  sleep 3
done
```

## Step 5b: Save build instructions (only if Step 1b was used)

If you explored the codebase in Step 1b (i.e. there were no saved instructions), append the build
instructions to `CLAUDE.md` so the next run skips exploration entirely.

If `CLAUDE.md` does not already have a `## Softlight Build Instructions` section, create one at the
end of the file. Then add a subsection for this app.

Write enough detail that a future agent can confidently determine whether this entry matches the
app it has been asked to start — even if the repo contains multiple similar apps. Include:

- A clear description of what the app is and what it serves (e.g. "the public-facing logged-out
  homepage" vs "the authenticated dashboard")
- The directory path where the app lives in the repo
- If there are other similar apps in the repo that could be confused with this one, explicitly call
  them out (e.g. "Not to be confused with `server/inspiration` which is the logged-in version")
- The exact start command
- How the port is configured (environment variable, CLI flag, etc.)
- Any prerequisites (install steps, environment variables, services that need to be running)
- How to verify the app is ready (health check endpoint and expected response)

Example format:

```markdown
## Softlight Build Instructions

### my-app

Public-facing marketing site. Located at `apps/web`. This is NOT the same as `apps/admin` which
is the internal admin dashboard.

To start: `PORT=$PORT npm run dev`

The server reads the `PORT` environment variable. No other setup is required.
Health check: `GET /` returns 200 when ready.
```

## Step 6: Start frpc and verify

Start the tunnel client and verify it is reachable in one command:

```bash
/tmp/$TUNNEL_BINARY_NAME/frpc -c /tmp/frpc-$TUNNEL_ID.toml &
FRPC_PID=$!
sleep 1
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$TUNNEL_URL/")
  echo "Attempt $i: HTTP $CODE"
  [ "$CODE" -ge 200 ] && [ "$CODE" -lt 400 ] && echo "Tunnel is up" && break
  sleep 0.5
done
echo "frpc_pid=$FRPC_PID"
```

If all 5 attempts fail, check frpc logs for errors.

## Step 7: Return

Return all of the following:

- The **port** the application is listening on
- The **app PID** of the background process
- The **start command** used
- The **tunnel URL** (`$TUNNEL_URL`)
- The **frpc PID** (`$FRPC_PID`)
