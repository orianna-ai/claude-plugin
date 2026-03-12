---
name: start-application
description: "Find and run a web app's dev server on a free port. Returns the port, PID, and start command."
allowed-tools: Bash, Read, Glob, Grep
model: haiku
---

# Start Application

Start a web application on a free port. Never write your own scripts or scaffolding.

## Step 1: Find the start command

Find the application's existing dev server command from its build/config files (e.g. `package.json`,
`Makefile`, `BUILD.bazel`, `pyproject.toml`, etc.). Use the first one you find — do not keep
searching after you have a working command.

## Step 2: Find a free port

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

- The `port` the application is listening on
- The `pid` of the background process
- The **start command** used
