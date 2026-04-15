---
name: start-tunnel
description: Create a tunnel between a local port and Softlight. Requires an application to already be listening on the port. Returns the tunnel ID and PID.
---

# Start Tunnel

Run `start_tunnel.sh $PORT [$TUNNEL_ID]` with the port number of the running application. The tunnel ID is optional — if omitted, a new UUID is generated.

The script prints `TUNNEL_ID=...` and `PID=...`.
