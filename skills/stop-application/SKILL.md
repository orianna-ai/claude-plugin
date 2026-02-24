---
name: stop-application
description: Stop a running application server that was started with start-application. Use when the user wants to stop, kill, shut down, or tear down a running application, server, or service.
---

# Stop Application

## Workflow

### 1. Identify the process

If the user specifies which application to stop, find the matching terminal by
scanning running terminals for the application name in recent commands.

If the user doesn't specify, list all terminals that appear to be running
server processes (look for commands containing `run`, `serve`, `dev`, `start`,
or listening-on-port messages in output). Ask the user which one to stop if
there are multiple.

### 2. Stop the process

Kill the process using the PID from the terminal metadata. Use `kill` with the
PID. If the process was started with `setsid` or as a process group, kill the
group with `kill -TERM -<PID>`.

If a graceful kill doesn't work within a few seconds, escalate to `kill -9`.

### 3. Stop the tunnel

Find and kill the `frpc` process associated with the application. Look for
`frpc` processes whose command line contains the tunnel ID (e.g. `frpc http ... -n <tunnel_id>`).
Kill the `frpc` process.

If you can't find the specific `frpc` process, search for any `frpc http`
process.

### 4. Verify shutdown

Read the terminal output to confirm the process exited. Look for shutdown
messages (e.g. `Shutting down`, `Finished server process`, `exited`) or check
that the PID is no longer running with `kill -0 <PID>`.

Also verify the `frpc` process is no longer running.

### 5. Report

Tell the user which application was stopped, which port was freed, and that
the tunnel was torn down.
