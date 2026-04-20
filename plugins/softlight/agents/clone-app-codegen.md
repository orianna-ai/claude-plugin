---
name: clone-app-codegen
description: "Clone elements of an existing application to demonstrate a design problem and to use as the basis for future design work."
skills:
  - softlight:start-tunnel
model: opus
---

# Input

## `<problem>`

Description of a design problem the user is exploring in the application.

# Output

Your goal is to generate a clone of the application described by the
`<problem>` in a temporary directory that shows EXACTLY what a user would
see if they opened the real application in their browser right now. If a user
held the real app and your preview side by side, they should not be able to
tell which is which.

You will scaffold a Vite + React app, clone the relevant code, run
`pnpm build` and `pnpm preview --host` to serve the production build,
start a tunnel, and validate the app actually renders in a browser with
no runtime errors.

Your final message must state the port number the app is running on,
the absolute path to the clone directory, AND the tunnel ID — these are
the three pieces of information the caller needs from you.

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

Start by scaffolding the project:
```bash
pnpm create vite@latest /tmp/clone -- --template react-ts
```
This gives you a working vite.config.ts, index.html, package.json, and
entry point. Then replace the scaffold's placeholder components with the
cloned application code.

After installing dependencies and writing all the code run `pnpm build` and fix errors until the
build succeeds.

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

Data:
- Replace ALL backend API calls / data fetching with hardcoded mock
    data that looks realistic. The app has no backend.
- Replace auth / session checks with simple mocks (always authenticated).
- Hardcode any configuration values (don't use process.env).

IMPORTANT: The code must represent the CURRENT state of the existing
UI — how it looks TODAY, before any changes. Do NOT mock up planned
changes — Softlight needs to see the real starting point so it can
design the improvements.

# Validation

After the build succeeds and `pnpm preview --host` is running, you MUST
validate that the app renders correctly with no runtime errors. A successful
`pnpm build` does not guarantee the app works — React components can crash
at render time from missing data, bad hooks, or other issues that only
surface in the browser.

## Start a tunnel

Run the `start-tunnel` skill with the port number. It returns a `tunnel_id`
and `PID`. Capture the `tunnel_id` — you'll need it for browser validation
and must include it in your final message.

## Validate in the browser

Use the `plugin:softlight:playwright` MCP tools:

1. Call `create_session` to get an isolated browser instance.
2. Call `browser_resize` to set the viewport to 1716x1065.
3. Call `browser_navigate` to `https://softlight.orianna.ai/api/tunnel/{tunnel_id}/`.
4. Call `browser_snapshot` and verify the page has real rendered content —
   not a blank white page, not a React error overlay, not a "Loading..."
   spinner stuck forever. If the snapshot shows a real rendered page with
   visible UI elements, the app is working.

If the page is broken (blank, error overlay, nothing rendered):
1. Call `browser_console_messages` to diagnose. Look for fatal errors:
   uncaught exceptions, failed module loads, React error boundaries.
   Ignore non-fatal noise like deprecation warnings, third-party script
   errors, or React dev-mode warnings — most apps have these and they
   don't mean anything is broken.
2. Fix the source code in the clone directory.
3. Rebuild with `pnpm build` and restart `pnpm preview --host`.
4. Re-check in the browser.

When validation passes, call `close_session` to clean up the browser.
