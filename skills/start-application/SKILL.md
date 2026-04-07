---
name: start-application
description: "Find and run a web app's dev server on a free port. Returns the port, PID, and start command."
---

# Start Application

You will receive the design problem and/or app that you are to start. You must start the web
application on a free port.

## Step 1: Find the start command
First, find the app that you are meant to start. You may be operating in a monorepo, so find the
right app.

Then, find the command used to run the dev server for the application you are to start. It is
essential you start that application, and not another one if you are in a monorepo. 

Use the Glob and Grep tools to find the command used to start the server. You are looking for the
command a developer would use to run the application locally. It's often mentioned in build files
(`package.json`, `Makefile`, `BUILD.bazel`, `pyproject.toml`, etc.) or in documentation.

We care about running the application once and that the application starts fast. If there are
multiple potential commands, pick the one that best fits to get it started the fastest.

## Step 2: Find a free port

You MUST find a free port to run the application. Always check available ports and find a free port.
Start from 50000 and increment by 1 until you find a free port.

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

## Step 4: Return

Once the server is confirmed to be live by step 3, you can return

- The `port` the application is listening on
- The `pid` of the background process
- The **start command** used
