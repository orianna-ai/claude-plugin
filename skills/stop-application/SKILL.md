---
name: stop-application
description: Find and kill a running application server started by start-application. Identifies the process, sends a graceful kill, verifies shutdown, and reports which port was freed.
allowed-tools: Bash
model: haiku
---

# Stop Application

## Step 1: Identify the process

If you have the **PID** from `start-application`, use that directly. Otherwise, find the process
by looking for servers listening on the expected port:

```
ss -tlnp | grep <port>
```

## Step 2: Stop the process

Kill the process: `kill <PID>`. If it doesn't exit within a few seconds, escalate to `kill -9`.

## Step 3: Verify shutdown

Confirm the process is gone: `kill -0 <PID>` should fail.

## Output

Tell the user which application was stopped and which port was freed.

If there is also a tunnel running, remind the user to run `stop-tunnel` to tear it down separately.
