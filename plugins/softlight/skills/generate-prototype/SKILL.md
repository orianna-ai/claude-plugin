---
name: generate-prototype
description: "Build a standalone prototype app from the baseline clone that implements a design idea, run it on its own port, and register it on the canvas."
---

# Generate Prototype

You are building a standalone prototype — a copy of the baseline app with design changes made
directly in the source code. Each prototype is its own running application with its own tunnel,
not a script injected into a shared app.

## Input

### `<project_id>`

Softlight project UUID.

### `<slot_id>`

Canvas slot UUID.

### `<spec>`

Description of the desired change to the application.

### `<images>`

Optional. Image URLs or local file paths, one per line. If these are passed, view all of these before writing code. The spec references them.

### `<caption_slot_id>`

Optional. Canvas slot UUID for the caption below this prototype. If provided, fill it in after
registering the prototype (see Phase 6).

### `<baseline_dir>`

The directory path of the baseline clone — the already-built, runnable app created by
`clone-app-codegen`. This is your starting point.

### `<prototype_dir>`

Optional. If this prototype is a revision of an existing one, the directory path of the
previous prototype app. Start from there instead of copying the baseline fresh — it already
has the prior design changes applied.

### `<context>`

Optional pre-explored source code and analysis from the caller. May cover routing, auth, data
fetching, response shapes, and styling patterns.

**Explore the codebase yourself.** You have full access to the source code — use it to understand
whatever you need about the app. Read local source files, not the tunnel URL.

## Before you start: MCP startup

You are launched as one of several parallel sub-agents, so the `softlight` and `playwright` MCP
servers may take up to 3 minutes to finish connecting on cold start. If `ToolSearch` reports
`pending_mcp_servers` includes either server, or if a tool call errors with "tool not available"
or returns no matches, **wait and retry — do not give up**. Sleep ~30 seconds and try again, up
to 5 times (~2.5 minutes total). Treat an MCP as truly unavailable only after that full window
has elapsed. Never return a "cannot proceed" / "MCP disconnected" message before then — your job
is to keep waiting until the connection comes up, then do the work. You can do filesystem and
build work (Phase 1) while waiting; only Phases 3–6 require the MCPs.

The MCP tools are registered as `mcp__softlight__*` (e.g. `mcp__softlight__update_iframe_element`,
`mcp__softlight__update_text_element`) and `mcp__playwright__*` (e.g. `mcp__playwright__create_session`,
`mcp__playwright__browser_navigate`) in this subagent. Do **not** search for
`mcp__plugin_softlight_*__*` — that namespace only exists in the user's parent session, never in
subagents spawned via `--mcp-config`.

### HTTP fallback for MCP tools

Always try to use the built-in MCP tools first. If a built-in MCP tool is still unavailable after
the full retry window, you may call the same MCP server directly over HTTPS using plain `curl`.
This is still MCP, just over HTTP instead of through the built-in tool binding.

- Softlight MCP endpoint: `https://softlight.orianna.ai/mcp/`
- Playwright MCP endpoint: `https://playwright.orianna.ai/mcp/`
- This transport is session-based. You must:
  1. send `initialize`
  2. capture the `Mcp-Session-Id` response header
  3. send `notifications/initialized`
  4. then send `tools/list` or `tools/call` with that same `Mcp-Session-Id`
- If you need to call a tool over HTTP MCP, it is helpful to call `tools/list` first for that
  server so you can see the tool schema and use the right argument shape.
- Responses from HTTP MCP come back as SSE frames such as `event: message` and `data: {...}`.
  If you need to inspect the JSON result, extract the `data:` line and parse that JSON.
- Always send:
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream`
- Always try the built-in MCP tools first. Use direct HTTP MCP only as a fallback when the tool
  binding is still unavailable after waiting.

Minimal pattern:

```bash
MCP_URL="https://softlight.orianna.ai/mcp/"
HDR=$(mktemp)
INIT=$(mktemp)

curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D "$HDR" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-03-26",
      "capabilities":{},
      "clientInfo":{"name":"curl","version":"1.0"}
    }
  }' >"$INIT"

SESSION_ID=$(grep -i '^mcp-session-id:' "$HDR" | awk '{print $2}' | tr -d '\r\n')

curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null

curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

rm -f "$HDR" "$INIT"
```

**Persisting `SESSION_ID` across `Bash` invocations.** Each `Bash` tool call is a fresh
shell, so variables don't survive. If you need the session id for a follow-up `Bash` call,
save it with `mktemp` too — e.g. `SID_FILE=$(mktemp); echo "$SESSION_ID" > "$SID_FILE"`,
then read it back with `$(cat "$SID_FILE")` in subsequent calls. Don't write to a fixed
path like `/tmp/mcp_session_id` — parallel agents would race on it the same way they would
on `/tmp/mcp_headers.txt`.

To call a tool, send:

```bash
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"update_text_element",
      "arguments":{
        "project_id":"<project_id>",
        "slot_id":"<slot_id>",
        "text":"example"
      }
    }
  }'
```

Use the tool names exactly as MCP exposes them, without the `mcp__softlight__` or
`mcp__playwright__` prefix. For example:
- `mcp__softlight__update_iframe_element` -> `update_iframe_element`
- `mcp__softlight__update_text_element` -> `update_text_element`
- `mcp__playwright__create_session` -> `create_session`
- `mcp__playwright__browser_navigate` -> `browser_navigate`

## Phase 1: Create the prototype app

1. **Copy the source.** If `<prototype_dir>` was provided (revising an existing prototype),
   copy that directory — it already has the prior design changes. Otherwise, copy the baseline.
   Use `rsync` with `--exclude=node_modules` — copying node_modules breaks pnpm's symlinks into
   the store and wedges module resolution:

   ```bash
   rsync -a --exclude=node_modules --exclude=dist <prototype_dir or baseline_dir>/ /tmp/prototype_<slot_id>/
   ```

   Install dependencies with `pnpm` (fast, deduplicates across prototypes automatically):

   ```bash
   cd /tmp/prototype_<slot_id> && pnpm install --prefer-offline
   ```

2. **Read the spec.** Understand what design change is being requested.

3. **Explore the codebase.** Read the baseline clone's files and the original application
   source to understand the component structure, design system, routing, data shapes, and
   styling. You need deep understanding to make changes that feel native to the app.

4. **Make the design changes.** Edit the prototype's files to implement the spec. The result
   should feel like a well-designed, fully functioning app — not a rough mockup. If your
   changes introduce new UI that needs data, seed realistic mock data. Generate all code for
   the prototype in one `.tsx` file and generate all styles for the prototype in one `.css` file.

   ### Styling rules

   **Use inline styles for layout on new elements.** When you create new containers or
   wrappers, put layout properties — `display`, `flexDirection`, `alignItems`,
   `justifyContent`, `gap`, `padding`, `width`, `maxWidth`, `gridTemplateColumns` — directly
   on the element as inline styles. This keeps layout visible and co-located with the JSX,
   preventing cascade bugs from a separate CSS file. Do not create new CSS classes for layout.

   **Use the app's existing CSS classes for visual styling.** Colors, fonts, borders, shadows,
   border-radius, transitions — these come from the app's design system. Read the existing CSS
   to find the right classes and values. Never hardcode approximate colors. Never load external
   CSS frameworks or component libraries when the app already has its own.

   **Do not modify existing CSS class definitions.** If you need different behavior, create a
   new element with inline styles rather than changing a class that other elements depend on.

5. **Build and serve the app.** Run a production build, then serve it on a free port.
   **Do NOT use the default port (5173)** — multiple prototypes run in parallel and will
   collide. Find a free port and bind to `127.0.0.1` explicitly (avoid IPv6 `[::1]`
   ambiguity):
   ```bash
   cd /tmp/prototype_<slot_id> && pnpm build
   ```
   Fix any build errors until the build succeeds, then serve the production build.
   The preview server must outlive this subagent — the canvas iframe will keep loading
   it for hours after you finish. A bare `&` is **not enough**: when this subagent's
   shell tears down, the preview process gets SIGHUP'd and dies, leaving the tunnel
   pointing at nothing (frp returns "page not found"). You must `nohup` to ignore
   SIGHUP, redirect stdout/stderr to a log so the bash tool returns immediately
   instead of waiting on the long-running process, and `disown` to detach it from
   the shell's job table:
   ```bash
   PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
   cd /tmp/prototype_<slot_id>
   nohup pnpm preview --host 127.0.0.1 --port $PORT --strictPort > preview.log 2>&1 &
   disown
   ```
   Wait a couple of seconds, then `cat preview.log` to confirm the server printed the
   port it's listening on. Capture that port number.

## Phase 2: Start a tunnel

Run the `start-tunnel` skill with the port number from Phase 1. It returns a `tunnel_id` and
`PID`. Capture the `tunnel_id` — you'll need it for Phase 3, Phase 4, and Phase 5.

## Phase 3: Validate in the browser

After the build succeeds and `pnpm preview` is running, you MUST validate that the app renders
correctly with no runtime errors. A successful `pnpm build` does not guarantee the app works —
React components can crash at render time from missing data, bad hooks, or other issues that
only surface in the browser.

Use the `playwright` MCP tools (registered as `mcp__playwright__*`):

1. Call `create_session` to get an isolated browser instance.
2. Call `browser_navigate` to `https://softlight.orianna.ai/api/tunnel/{tunnel_id}/`.
3. Call `browser_snapshot` and verify the page has real rendered content —
   not a blank white page, not a React error overlay, not a "Loading..."
   spinner stuck forever. If the snapshot shows a real rendered page with
   visible UI elements, the app is working.

If the page is broken (blank, error overlay, nothing rendered):
1. Call `browser_console_messages` to diagnose. Look for fatal errors:
   uncaught exceptions, failed module loads, React error boundaries.
   Ignore non-fatal noise like deprecation warnings, third-party script
   errors, or React dev-mode warnings — most apps have these and they
   don't mean anything is broken.
2. Fix the source code in the prototype directory.
3. Rebuild with `pnpm build` and restart `pnpm preview --host`.
4. Re-check in the browser.

When validation passes, call `close_session` to clean up the browser.

## Phase 4: Screenshot the prototype

You MUST use the `playwright` MCP (tools registered as `mcp__playwright__*`) for all browser interactions. All standard Playwright browser tools are available through this MCP. It is a thin wrapper around Playwright MCP that gives each session its own isolated browser, so multiple prototype agents can browse in parallel without conflicts.

Open the prototype in a browser and screenshot it so reviewers can see the design changes. The task is to take screenshot(s) of the prototype in states where the design change(s) are visible.

If the page isn't loading or the browser becomes unresponsive, check the preview server output for build errors, fix them, and retry. Try up to 3 times before giving up. If the prototype still won't load, return whatever screenshots you managed to capture (even none) and move on.

Call `create_session` to get an isolated browser instance. Resize the viewport to 1716x1065.
Ensure you find the design change(s) so you can screenshot the design
changes and look at it. You may need to interact with the prototype to find all the design
changes to screenshot them (the codebase, spec, and source code can help you figure out what screenshots you need to take).

1. Navigate to `https://softlight.orianna.ai/api/tunnel/{tunnel_id}/`
2. Check that the page loaded, then find the design changes described in the spec. You  may need to interact with the application to get the app into a state where the design change is visible. Reminder: pages could be broken or stuck loading. If that happens, move on — do not wait indefinitely.
3. Take a screenshot with `browser_take_screenshot` (`fullPage` set to `true`). This returns a URL.
4. Call `close_session` to clean up the browser

## Phase 5: Register on the canvas

Call the `update_iframe_element` MCP tool with `project_id`, `slot_id`, `tunnel_id` (the new
tunnel from Phase 2), `source_dir` (the absolute path to `/tmp/prototype_<slot_id>` from
Phase 1 — stamping this lets later agents find the code you wrote), `spec` (the `<spec>`
from your input — pass it through unchanged), `screenshot_urls` (the **drive URLs** from
Phase 4), and `preview_url` set to the screenshot that best represents the core of the
design change.

## Phase 6: Fill in the caption

If `<caption_slot_id>` was provided, call `update_text_element` with `project_id`,
`slot_id` set to the `<caption_slot_id>`, and a short `text` (1-2 sentences) describing what
this prototype does, how it solves the problem, and what its tradeoffs are.
