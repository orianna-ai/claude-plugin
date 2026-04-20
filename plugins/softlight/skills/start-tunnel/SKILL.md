---
name: start-tunnel
description: Create a tunnel between a local port and Softlight. Requires an application to already be listening on the port. Returns the tunnel ID and PID.
---

Run `${CLAUDE_SKILL_DIR}/start-tunnel <port>` to create a tunnel between Softlight and the local
port an application is listening on. The script will print `TUNNEL_ID=<tunnel_id>` and `PID=<pid>`.
You can view the application by navigating to `https://softlight.orianna.ai/api/tunnel/<tunnel_id>/`
while the tunnel is running, and you can stop the tunnel by killing the `<pid>`.

The tunnel is a **reverse**, **rewriting** proxy.

- **Reverse** — the application never makes an outbound connection to Softlight. Instead, `frpc`
  maintains a persistent WSS connection to `frp.orianna.ai`, and inbound requests to
  `https://softlight.orianna.ai/api/tunnel/<tunnel_id>/...` are routed back over that connection to
  your local port.

- **Rewriting** — the application is served under the `/api/tunnel/<tunnel_id>/` prefix, not at the
  root it expects. The proxy makes this work by add the prefix to root-relative attributes such as
  `src`, `href`, and `action` and browser APIs such as `fetch`, `XMLHttpRequest`, `EventSource`, and
  `WebSocket` to ensure requests are forwarded through the tunnel while stripping the prefix from
  `history.replaceState` so that client-side routers still see the bare path.
