---
name: start-tunnel
description: Create a tunnel between a local port and Softlight. Requires an application to already be listening on the port. Returns the tunnel ID and PID.
---

Run `python3 ${CLAUDE_SKILL_DIR}/start_tunnel.py --port <port>` to create a tunnel between Softlight
and the local port an application is listening on. The script will print `tunnel_id=<tunnel_id>`,
`frpc.pid=<frpc_pid>`, and `tunnel_url=<tunnel_url>`. You can view the application by navigating to
the `<tunnel_url>` while the tunnel is running and you can stop the tunnel by killing the
`<frpc_pid>`.

The tunnel is a **reverse**, **rewriting** proxy.

- **Reverse** — the application never makes an outbound connection to Softlight. Instead, `frpc`
  maintains a persistent WSS connection to `frp.orianna.ai`, and inbound requests to `<tunnel_url>`
  are routed back over that connection to `localhost:<port>`.

- **Rewriting** — the application is served under the `/api/tunnel/<tunnel_id>/` prefix, not at the
  root it expects. The proxy makes this work by add the prefix to root-relative attributes such as
  `src`, `href`, and `action` and browser APIs such as `fetch`, `XMLHttpRequest`, `EventSource`, and
  `WebSocket` to ensure requests are forwarded through the tunnel while stripping the prefix from
  `history.replaceState` so that client-side routers still see the bare path.
