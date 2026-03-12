---
name: stop-tunnel
description: Kill the frpc process for a Softlight tunnel started by start-tunnel. Cleans up the config file and verifies the process is gone.
---

# Stop Tunnel

## Input

A <frpc_pid> from `start-tunnel`. If unavailable, find it: `ps aux | grep frpc`.

## Steps

1. Kill the process: `kill <frpc_pid>`. If it doesn't exit within 2s, `kill -9 <frpc_pid>`.

2. Remove the config file: `rm -f /tmp/frpc-*.toml`

3. Verify the process is gone: `kill -0 <frpc_pid>` should fail with "No such process".

## Return

Report which PID was stopped and which port was freed.
