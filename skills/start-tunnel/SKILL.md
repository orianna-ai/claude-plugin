---
name: start-tunnel
description: Create a tunnel between a local port and Softlight. Requires an application to already be listening on the port. Returns the tunnel ID and PID.
---

# Start Tunnel

Run `start_tunnel.sh $PORT` with the port number of the running application.

The script prints `TUNNEL_ID=...`, `TUNNEL_URL=...`, and `PID=...`. Return those values to the caller.
