---
name: start-application
description: "Find and run a web app's dev server on a free port. Returns the port, PID, and start command."
tools: Bash, Read, Write, Glob, Grep
model: sonnet
---

# Start Application

You will receive the design problem and/or app that you are to start. You must start the web
application on a free port.

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

You MUST find a free port to run the application. Always check available ports and find a free port.

```bash
ss -tlnp | grep -oP ':\K[0-9]+' | sort -n > /tmp/_used_ports.txt
PORT=50000; while grep -qx "$PORT" /tmp/_used_ports.txt; do PORT=$((PORT+1)); done; echo "$PORT"
```

## Step 3: Run as background process and poll

Run the start command with the chosen port as a background process (`&`), then poll:

```bash
for i in $(seq 1 40); do
  kill -0 $PID 2>/dev/null || { echo "Process exited"; exit 1; }
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT | grep -qE '^[23]' && break
  sleep 3
done
```

## Step 4: Save build instructions (only if Step 1b was used)

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

## Step 5: Return

Once the server is confirmed to be live by step 3, return:

- The `port` the application is listening on
- The `pid` of the background process
- The **start command** used
