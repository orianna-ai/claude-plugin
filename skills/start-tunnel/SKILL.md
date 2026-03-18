---
name: start-tunnel
description: Create a tunnel between a local port and Softlight. Requires an application to already be listening on the port. Returns the tunnel URL and PID.
model: sonnet
allowed-tools: Bash
---

# Start Tunnel

Run `start_tunnel.sh $PORT` with the port number of the running application.

The script prints `TUNNEL_URL=...` and `PID=...`. Return those two values to the caller.
