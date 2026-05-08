---
name: clone-app
description: "Clone elements of an existing application to demonstrate a design problem and to use as the basis for future design work."
---

# Input

## `<project_context>`

The Softlight project context, including the live intake transcript. Use it to determine which
application, product surfaces, and current states should be cloned.

## `<screenshots>`

Captured screenshot records from the real product the PM showed during the live intake call. They are also attached as image blocks.

## `<project_id>`

Softlight project id. Use this when registering the cloned baseline back to the project.

## `<cloned_code_dir>`

Absolute path to the pre-scaffolded clone project. Write all your output here.
The harness has already populated this directory with `package.json`,
`vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, and a
placeholder `src/App.tsx`, and has run `pnpm install`.

# Output

Your goal is to write the source code for a clone of the application that has the problem
described in the transcript in `<project_context>` into `<cloned_code_dir>` so it shows EXACTLY what a user would see if they opened the real application in their browser right now. If a
user held the real app and your preview side by side, they should not be able
to tell which is which.

You are responsible for writing the application code into
`<cloned_code_dir>/src/` and getting `pnpm build` (run from
`<cloned_code_dir>`) to pass, then previewing, screenshotting, and registering the baseline.
Do not scaffold a new project.


### MCP HTTP fallback

Always try to use the built-in MCP tools first. If a needed Softlight or Playwright tool times
out once or is still unavailable after a short retry window, call the same MCP server directly
over HTTPS with plain `curl`. Do not loop on the built-in tool after a timeout.

For "tool not available", missing tool listings, or `pending_mcp_servers`, use a short retry
window only: sleep ~15 seconds and try again, up to 4 times, then fall back
to HTTP MCP.

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
- If you need to persist `SESSION_ID` across separate `Bash` invocations (each `Bash` call
  is a fresh shell, so variables don't survive), save it with `mktemp` too — e.g.
  `SID_FILE=$(mktemp); echo "$SESSION_ID" > "$SID_FILE"`, then read it back with
  `$(cat "$SID_FILE")` in subsequent calls. Don't write to a fixed path like
  `/tmp/mcp_session_id` — parallel agents would race on it.

When calling a tool over HTTP MCP, use the bare MCP tool name without the `mcp__softlight__` or
`mcp__playwright__` prefix. For example:
- `mcp__playwright__create_session` -> `create_session`
- `mcp__playwright__browser_take_screenshot` -> `browser_take_screenshot`
- `mcp__playwright__close_session` -> `close_session`

For this skill, the Softlight registration tool is `mcp__softlight__update_project` ->
`update_project`.

# Guidelines

CRITICAL — always render the FULL PAGE, not just a component:

Before gathering code, build a complete picture of the page:

1. Find the page the feature lives on. If the user mentions a specific
    component, walk UP the import chain to find which page-level route
    component renders it. That page is your starting point — NOT the
    component itself.
2. From that page component, walk DOWN: for every child component it
    imports and renders (<Sidebar />, <Header />, <Card />, etc.), open
    that component's file AND its CSS/style file together. Read both —
    the TSX tells you what it renders, the CSS tells you how it looks.
    Then repeat recursively for that component's children. Keep going
    until you reach leaf components. Follow the tree for everything
    rendered on THIS page. Do not follow route navigations or
    lazy-loaded pages — only components that are part of the current
    page's visible output.
3. Now you have the full picture of what the user sees. Every component
    you read must be included in the code you provide — do NOT skip
    components because they seem minor or unrelated to the feature.
    A sidebar, a breadcrumb bar, a loading spinner, an avatar, a
    header, a footer — they all contribute to what the page actually
    looks like. Include ALL of them.
4. Read any global/token CSS files (design tokens, variables, themes)
    and include them in your code collection.

Produce the FULL PAGE with the feature visible — all components
composed together in their correct positions. NOT a standalone preview
of the single component the user mentioned. If the feature lives on
the settings page, you provide the entire settings page. If it lives
on a dashboard, you provide the entire dashboard. One page, one
complete browser viewport. Pick the single most representative state
(e.g. the state where the feature is visible and the page has
realistic content).

When the feature involves an element that appears on top of or within
a page — a dropdown menu, a modal, a tooltip, a popover, a slide-out
panel, a toast — always provide the full page code with that element
rendered open and visible. Never provide these elements in isolation.
The user needs to see where the element is anchored, what it overlays,
and how it relates to the surrounding UI. Include all sibling elements
too — for example, if the feature is a new menu item under a user
icon, the app should show the entire page with the menu open,
including all existing menu items, not just the menu by itself.

CRITICAL — self-containment (import graph):
For EVERY relative import in every file you collected, make sure
the imported file is ALSO in your collection. Walk the full import
graph — utilities, hooks, types, constants, context providers,
everything. If a file imports "./utils/cn", that utils file must
be included. Missing files are the #1 cause of build failures.

CRITICAL — output a Vite + React app (client-side only):
The clone is served through a tunnel proxy that rewrites HTML responses
(rewriting URLs, injecting scripts). Server-side rendering frameworks
break in this setup because the proxy modifies the server-rendered HTML,
causing hydration mismatches on the client. The clone must be a plain
client-side React app built with Vite. No SSR, no hydration, no server
rendering. If the source app uses a framework that does server-side
rendering, fully deframework it — the output must have zero dependencies
on the original framework.

CRITICAL — no server-side or Node.js APIs:
This runs in the browser. You must remove or replace:
- process.env.* → hardcode the value directly
- fs, path, crypto (Node.js modules) → remove or use browser equivalents
- Database clients, ORMs → remove, return mock data
- Any server-only imports → remove

Styling:
- Keep ALL styling EXACTLY as the original app uses it. Copy the CSS
    classes, CSS files, inline styles, CSS modules — whatever the app uses.
    Do NOT change the styling approach. If it uses Tailwind, keep Tailwind.
    If it uses CSS modules, keep CSS modules. If it uses styled-components,
    keep styled-components.
- Copy exact CSS values — colors, font sizes, font weights, line heights,
    letter spacing, padding, margin, border-radius, box-shadow, gap,
    flex/grid layout — from each component's CSS file. Also copy the exact
    text content from the TSX (placeholder strings, button labels, headings)
    — do not rephrase them.
- If components import from a UI library (shadcn, MUI, Chakra, etc.),
    include those component source files or inline their markup with the
    exact same styling.
- Inline all SVG icons directly as JSX — never use placeholder boxes or
    missing icon references. If an icon import cannot be resolved, replace
    it with the actual SVG markup for that icon. For icons defined as SVG
    components in the codebase, copy the entire <svg> element including its
    <path> data verbatim. For library icons (e.g. lucide-react), inline
    the standard SVG for that icon.
- Reproduce the app's font setup however it's loaded — Google Fonts
    `<link>` tags in the root `index.html`, `@import` rules in CSS,
    `@font-face` with bundled `.woff`/`.woff2`/`.ttf`/`.otf` files,
    design-system stylesheet imports like `@radix-ui/themes/styles.css`,
    and any `--default-font-family` / `--heading-font-family` variables
    those wrappers define. Bring ALL of them over to the clone exactly as
    the source delivers them. The most common miss is a Google Fonts
    `<link>` in the root `index.html` paired with a font variable on a
    theme root — both must come together. Page-level CSS using
    `font-family: inherit` is a signal the typography is configured higher
    up in the app shell; go find it before assuming there's nothing to
    copy. Do the same for static assets (images, icons, logos, brand
    assets) — copy the real files and preserve the relative paths used in
    `src` / `href` attributes. Missing fonts and assets are immediately
    visible and make the clone look wrong.

Data:
- Replace ALL backend API calls / data fetching with hardcoded mock
    data that looks realistic. The app has no backend.
- Replace auth / session checks with simple mocks (always authenticated).
- Hardcode any configuration values (don't use process.env).

IMPORTANT: The code must represent the CURRENT state of the existing
UI — how it looks TODAY, before any changes. Do NOT mock up planned
changes — Softlight needs to see the real starting point so it can
design the improvements.

# Workflow

# 1. Find the product app and relevant surfaces to clone

The transcript in `<project_context>` and the attached screenshots are about an existing product.
Your first task is to find:

- the application root for where the code is for the app
- the current surfaces that are relevant to the product problem and should be cloned

Use the transcript to understand the product, workflow, and problem the PM is talking about. Use
the screenshots to identify the visible UI state(s) and current experience.

# 2. Write the code for the clone

Write all the code for the application into `src/`. Generate all TypeScript
code for the clone in one `.tsx` file (replacing the placeholder
`src/App.tsx`) and generate all CSS styles for the clone in one `.css`
file. This limits the number of tool calls required to generate the
application and reduces the likelihood of import errors.

# 3. Install dependencies

Align dependency versions with the original application.

Then, run the following command to install dependencies:

```bash
pnpm install --prefer-offline
```

# 4. Make the build pass

Keep running `pnpm build` (from the clone directory) and fixing errors
until the build passes.

# 5. Preview and tunnel the clone

Start the clone preview server from `<cloned_code_dir>`. Pick an available port and bind to
`127.0.0.1` explicitly (avoid IPv6 `[::1]` ambiguity). The preview server must outlive this
subagent. A bare `&` is **not enough**: when this subagent's shell tears down, the preview process gets SIGHUP'd and dies, leaving the tunnel pointing at nothing (frp returns "page not found"). You must `nohup` to ignore SIGHUP, redirect stdout/stderr to a log so the bash tool returns immediately instead of waiting on the long-running process, and `disown` to detach it from the shell's job table:

```bash
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
cd <cloned_code_dir>
nohup pnpm preview --host 127.0.0.1 --port $PORT --strictPort > preview.log 2>&1 &
disown
```

Wait a couple of seconds, then `cat preview.log` to confirm the server printed the port it's
listening on. Capture that port number.

Run the `start-tunnel` skill with that port. It returns a `tunnel_id`. Capture it.

# 6. Screenshot and analyze the current experience

You MUST use the `playwright` MCP (registered as `mcp__playwright__*`) for all browser
interactions. All standard Playwright browser tools are available through this MCP. It is a
thin wrapper around Playwright MCP that gives each session its own isolated browser instance,
so multiple agents can browse different prototypes in parallel without conflicts. Use it to
view the running app and rendered prototypes.

Call `create_session` to get an isolated browser. Resize the viewport to 1716x1065.
Ensure you find the design change(s) so you can screenshot the design changes and look
at it. You may need to interact with the prototype to find all the design changes (the codebase
and spec can help you figure out what screenshots you need to take).

Prototype URL (each prototype has its own tunnel):
```
https://softlight.orianna.ai/api/tunnel/{tunnel_id}/
```

To view a design change from a prototype:
1. Navigate to the prototype URL
2. Check that the page loaded, then find the design changes described in the spec. You may need to interact with the application to get the app into a state where the design change is visible. Reminder: pages could be broken or stuck loading. If that happens, move on — do not wait indefinitely.
3. Take a screenshot of the design change with `browser_take_screenshot` (`fullPage` set to `true`). It returns a drive URL directly.

When you're done with the browser, call `close_session` to clean up.

For clone-app, treat "the design change" as the current baseline experience described by
`<project_context>` and the intake screenshots. Use the baseline tunnel URL from Step 3.

Use the browser instructions above. Navigate to:

```
https://softlight.orianna.ai/api/tunnel/{tunnel_id}/
```

Screenshot the key screen(s) relevant to the design problem. You may need to interact with the
clone to reach the relevant state. Take screenshots with `browser_take_screenshot` (`fullPage` set
to `true`); it returns drive URLs directly.

Before finishing, study what you captured. The screenshots should show the current experience in
relation to what the PM described. Code tells you what elements exist; screenshots show how the
experience feels. Your clone should be grounded in both.

Call `close_session` when done.


# 7. Register the baseline on the project

Call the `update_project` MCP tool with:

- `project_id`: `<project_id>`
- `source_code_dir`: `<cloned_code_dir>`
- `tunnel_id`: the tunnel id from Step 4
- `screenshot_urls`: the drive URLs from Step 5

For HTTP MCP fallback, call the bare tool name `update_project` with JSON arguments equivalent to:

```json
{
  "project_id": "<project_id>",
  "source_code_dir": "<cloned_code_dir>",
  "tunnel_id": "<tunnel_id>",
  "screenshot_urls": ["<drive_url_1>", "<drive_url_2>"]
}
```

This is the final step. Do not return before `update_project` succeeds.
