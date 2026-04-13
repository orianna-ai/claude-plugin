---
name: generate-prototype
description: Build a standalone prototype app from the baseline clone that implements a design idea, run it on its own port, and register it on the canvas.
model: opus
effort: max
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

### `<spec_url>`

Drive URL of the design spec. Download it with `curl` first. The response is JSON — extract the `spec` field. That text is a description of the desired change to the application. May contain image URLs (design mocks, screenshots of the current prototype or baseline) — examine these for additional visual context. Use `curl` to download each image URL to a local file first, then
**Read** it. Do **not** use WebFetch for images — it returns binary data as text and cannot
render them.

### `<images>`

Optional. Image URLs or local file paths, one per line. If these are passed, view all of these before writing code. The spec references them.

### `<caption_slot_id>`

Optional. Canvas slot UUID for the caption below this prototype. If provided, fill it in after
registering the prototype (see Phase 4).

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

## Phase 1: Create the prototype app

1. **Copy the source.** If `<prototype_dir>` was provided (revising an existing prototype),
   copy that directory — it already has the prior design changes. Otherwise, copy the baseline:
   ```bash
   cp -r <prototype_dir or baseline_dir> /tmp/prototype_<slot_id>
   ```
   Install dependencies with `pnpm` (fast, deduplicates across prototypes automatically):
   ```bash
   cd /tmp/prototype_<slot_id> && pnpm install
   ```

2. **Read the spec.** Download `<spec_url>` with `curl`, extract the `spec` field. View any
   referenced images. Understand what design change is being requested.

3. **Explore the codebase.** Read the baseline clone's files and the original application
   source to understand the component structure, design system, routing, data shapes, and
   styling. You need deep understanding to make changes that feel native to the app.

4. **Make the design changes.** Edit the prototype's files to implement the spec. The result
   should feel like a well-designed, fully functioning app — not a rough mockup. If your
   changes introduce new UI that needs data, seed realistic mock data.

   **Preserve the app's design system** — any new UI elements must match the app's existing
   aesthetics. Use the app's CSS variables, theme tokens, or class patterns — never hardcode
   approximate color values. Never load external CSS frameworks or component libraries when the app already has its own.

5. **Start the app.** Run the prototype's dev server on a free port. **Do NOT use the
   default port (5173)** — multiple prototypes run in parallel and will collide. Find a
   free port and bind to `127.0.0.1` explicitly (avoid IPv6 `[::1]` ambiguity):
   ```bash
   PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
   cd /tmp/prototype_<slot_id> && npx vite --port $PORT --host 127.0.0.1 --strictPort &
   ```
   Wait for the server to print the port it's listening on. Capture that port number.

## Phase 2: Start a tunnel

Run the `start-tunnel` skill with the port number from Phase 1. It returns a `tunnel_id` and
`PID`. Capture the `tunnel_id` — you'll need it for Phase 3 and Phase 5.

## Phase 3: Register on the canvas

Call the `update_iframe_element` MCP tool with `project_id`, `slot_id`, `tunnel_id` (the new
tunnel from Phase 2), and `spec_url` (the `<spec_url>` from your input — pass it through
unchanged).

## Phase 4: Fill in the caption

If `<caption_slot_id>` was provided, call `update_text_element` with `project_id`,
`slot_id` set to the `<caption_slot_id>`, and a short `text` (1-2 sentences) describing what
this prototype does, how it solves the problem, and what its tradeoffs are.

## Phase 5: Screenshot the prototype

Open the prototype in a browser and screenshot it so reviewers can see the design changes. The task is to take screenshot(s) if the prototype in states where the design change(s) are visible.

If the page isn't loading or the browser becomes unresponsive, check the dev server output for build errors, fix them, and retry. Try up to 3 times before giving up. If the prototype still won't load, return whatever screenshots you managed to capture (even none) and move on. The prototype is already on the canvas from Phase 3.

You have access to a headless browser via Softlight MCP `playwright` tools - a thin wrapper around Playwright MCP that gives each session its own isolated browser. All standard Playwright browser tools are available.

Call `create_session` to get an isolated browser instance. Resize the viewport to 1512x982
(MacBook Pro 14"). Ensure you find the design change(s) so you can screenshot the design
changes and look at it. You may need to interact with the prototype to find all the design
changes to screenshot them (the codebase, spec_url, and source code can help you figure out what screenshots you need to take).

1. Navigate to `https://softlight.orianna.ai/api/tunnel/{tunnel_id}/`
2. Check that the page loaded, then find the design changes described in the spec. You  may need to interact with the application to get the app into a state where the design change is visible. Reminder: pages could be broken or stuck loading. If that happens, move on — do not wait indefinitely.
3. Take a screenshot with `browser_take_screenshot` (`fullPage` set to `true`). This returns
   a **local filename**, not a URL. Upload it to drive to get a URL:
   ```bash
   curl -sF 'file=@<local_screenshot_path>' https://drive.orianna.ai/api/v2/upload
   ```
4. Call `set_iframe_screenshots` with `project_id`, `slot_id`, and the **drive URLs** from
   step 3 as `screenshot_urls`.
5. Call `close_session` to clean up the browser
