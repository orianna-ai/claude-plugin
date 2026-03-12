---
name: start-application
description: "Find and run a web app's dev server on a free port. Returns the port, PID, and start command."
allowed-tools: Bash, Read, Glob, Grep
model: haiku
---

# Start Application

<<<<<<< Updated upstream
Start a web application on a free port using the build.
=======
Start a web application on a free port. Never write your own scripts or scaffolding.
>>>>>>> Stashed changes

## Step 1: Find the start command

<<<<<<< Updated upstream
You will receive the application that you are to start.
=======
Find the application's existing dev server command from its build/config files (e.g. `package.json`,
`Makefile`, `BUILD.bazel`, `pyproject.toml`, etc.). Use the first one you find — do not keep
searching after you have a working command.
>>>>>>> Stashed changes

## Step 2: Find a free port

<<<<<<< Updated upstream
### 1. Figure out the run command
Figure out the command to start the application. This is what developers run to start the app. Never write your own server scripts, build scripts, or scaffolding. Never bypass the start command by running underlying binaries directly — it often handles invisible setup.

### 2. Find a free port
=======
```bash
ss -tlnp | grep -oP ':\K[0-9]+' | sort -n > /tmp/_used_ports.txt
PORT=50000; while grep -qx "$PORT" /tmp/_used_ports.txt; do PORT=$((PORT+1)); done; echo "$PORT"
```
>>>>>>> Stashed changes

## Step 3: Run as background process and poll

Run the start command with the chosen port as a background process (`&`), then poll:

<<<<<<< Updated upstream
Start at 50000 and increment until you find a free one.

### 3. Install dependencies
=======
```bash
for i in $(seq 1 40); do
  kill -0 $PID 2>/dev/null || { echo "Process exited"; exit 1; }
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT | grep -qE '^[23]' && break
  sleep 3
done
```

## Step 4: Return
>>>>>>> Stashed changes

- The `port` the application is listening on
- The `pid` of the background process
- The **start command** used
