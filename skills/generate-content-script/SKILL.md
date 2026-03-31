---
name: generate-content-script
description: Generate a content script — a self-contained JavaScript file that can be injected into a running application to prototype a design idea without rebuilding.
---

# Generate Content Script

You are implementing design feedback as a **content script** — a self-contained JavaScript file
injected into a running app that modifies its UI without rebuilding. The script is injected
**before any app JS runs**. Synchronous code (mocks, auth, route) runs at evaluation time. DOM
interactions run after `DOMContentLoaded`.

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
placing the content script (see Phase 4).

### `<tunnel_id>`

The tunnel ID for the running application. Used to construct the prototype URL for screenshotting.

### `<content_script_url>`

Optional. Drive URL of an existing content script. If this exists, download the content script it and edit from there instead of starting from scratch.

### `<context>`

Optional pre-explored source code and analysis from the caller. May cover routing, auth, data
fetching, response shapes, and styling patterns.

**Explore the codebase yourself.** You have full access to the source code — use it to understand
whatever you need about the app. Read local source files, not the tunnel URL.

## Phase 1: Write the content script

Write a content script that modifies the running app to implement `<spec>`. The app has its own
routing, components, data fetching, and design system — use them. Mock routes, auth, and API
responses so the app renders the desired state itself.

### Script structure

Write the script to `/tmp/content_script_<slot_id>.js` — multiple agents run in parallel so it needs a unique file path.

Wrap everything in a strict-mode IIFE. The script is injected before the app's own JavaScript, so
synchronous code at the top level (auth, routing, fetch mocks) takes effect before the app boots.
Any code that touches the DOM should wait for `DOMContentLoaded`. DOM overlays are injected into a
live application that continues to render after your script loads. Never assume the DOM is stable
after `DOMContentLoaded`. Wait for your target container to appear, and use a `MutationObserver` to
re-inject your elements if the application removes or replaces them.

### Fetch mocking

- Save the original `window.fetch` and fall through to it for URLs you don't mock.

- Handle `url` being a `Request` object — use `url instanceof Request ? url.url : String(url)`.

- Mock every endpoint the target screen fetches on mount.

- Always provide realistic mock data — never rely on the app's live database having enough
  (or any) data. Seed enough rows to make the prototype visually convincing (8–15 records
  with varied, realistic values). This ensures the prototype works regardless of database state.

- Match response shapes to what the components actually use, including nesting and array wrappers.

- Check how the app builds URLs — fetch clients may prepend env vars like `VITE_API_URL`.

- Seed auth before changing the route — the app may redirect to login without it.

### Working with the DOM

- **Data layer is the default** — mock fetch so the framework re-renders natively. Only touch the
  DOM when there is no data-layer alternative (e.g., injecting a new UI element that doesn't exist
  in the app).

- **Never hide or replace the app's root** — no `root.style.display = "none"`, no `innerHTML = ""`,
  no `replaceChildren()`. You are a guest in the app's page.

- **Never rebuild existing UI** — work with the app's own components through data or interactions.
  Do not create a parallel version of UI the app already provides (navigation, tables, grids, etc.).

- **DOM overlays for new features are fine** — if the design calls for UI that doesn't exist in the
  app (a sidebar panel, a grouping overlay, a new toolbar), building it with `createElement` is the
  right approach. The key distinction: use the app's components for things the app already renders,
  and build DOM only for genuinely new additions.

- If you must mutate the DOM, use `MutationObserver` to re-apply after framework re-renders. No
  fixed timeouts.

- **Watch for `overflow: hidden` ancestors** — many apps use `overflow: hidden` on flex containers
  to let grids/tables handle their own scrolling. If you insert a new element (e.g., a search bar)
  into one of these containers, it will be clipped. Before inserting, walk up the ancestor chain
  and check for `overflow: hidden` on any parent that uses `flex: 1` or a fixed height. Either
  insert your element *above* the `overflow: hidden` boundary, or temporarily adjust the container
  to `overflow: visible` / add space for your element.

- **Reuse existing CSS classes** — when building DOM overlays, apply the app's own CSS classes instead of writing inline styles. This inherits the app's theme (dark/light mode, colors,
  typography) automatically. Only fall back to CSS variables or inline styles for genuinely new
  elements that have no app equivalent.

- **Preserve the app's design system** — any new UI elements must match the app's existing
  aesthetics. Use the app's CSS variables, theme tokens, or class patterns — never hardcode
  approximate color values. Never load external CSS frameworks or component libraries when the app already has its own.

- You can import third-party libraries at runtime via `esm.sh`, e.g.:
  - `await import("https://esm.sh/@testing-library/dom")` for querying elements
  - `await import("https://esm.sh/@testing-library/user-event")` for simulating interactions


## Phase 2: Upload the content script

You MUST save the content script to a **unique file path** that includes the slot ID — e.g.,
`/tmp/content_script_<slot_id>.js`. Multiple content scripts may be generated in parallel, so
using a generic path like `/tmp/content_script.js` will cause race conditions where agents
overwrite each other's files.

Upload the content script via multipart form POST to `https://drive.orianna.ai/api/v2/upload`.
The response is the public URL of the uploaded file (e.g., `https://drive.orianna.ai/<hash>.js`).

## Phase 3: Place the content script on the canvas

Call the `update_iframe_element` MCP tool with `project_id`, `slot_id`, `content_script_url`
(the URL from Phase 2), and `spec_url` (the `<spec_url>` from your input — pass it through
unchanged). This replaces the placeholder slot with an iframe that loads the app with your
content script injected. All other iframe fields (`git_commit`, `tunnel_id`, `git_patch`)
are inherited from `problem.baseline` automatically so you don't have to fill them in.

## Phase 4: Fill in the caption

If `<caption_slot_id>` was provided, call `update_text_element` with `project_id`,
`slot_id` set to the `<caption_slot_id>`, and a short `text` (1-2 sentences) describing what
this prototype does, how it solves the problem, and what its tradeoffs are.

## Phase 5: Screenshot the prototype

Open the prototype in a browser and screenshot it so reviewers can see the design changes. The task is to take screenshot(s) if the prototype in states where the design change(s) are visible.

The `playwright-parallel` MCP is a thin wrapper around Playwright MCP that gives each session
its own isolated browser. All standard Playwright browser tools are available.

Call `create_session` to get an isolated browser instance. Resize the viewport to 1512x982
(MacBook Pro 14"). Ensure you find the design change(s) so you can screenshot the design
changes and look at it. You may need to interact with the prototype to find all the design
changes to screenshot them (the codebase, spec_url, and content_script can help you figure out what screenshots you need to take).

1. Navigate to `https://softlight.orianna.ai/api/tunnel/{tunnel_id}/?content_script_url={content_script_url}`
2. Wait for the page to load, then find the design changes described in the spec. You  may need to interact with the application to get the app into a state where the design change is visible.
3. To take a screenshot of the experience, use `browser_take_screenshot` with `filename` set to `/tmp/screenshot_<slot_id>_<i>.png` (where `i` is 1, 2, 3… if you need multiple screenshots) and `fullPage` set to `false`
4. Upload: `curl -sF 'file=@/tmp/screenshot_<slot_id>_<i>.png' https://drive.orianna.ai/api/v2/upload` — returns a drive URL
5. Call `set_iframe_screenshots` with `project_id`, `slot_id`, and `screenshot_urls`
6. Call `close_session` to clean up the browser
