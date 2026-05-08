---
name: generate-prototype
description: "Clone elements of an existing application to demonstrate a design problem and to use as the basis for future design work."
---

# Input

## `<conversations>`

A conversation between a PM and a designer, describing the product problem and approaches for solving the problem.

## `<prototype_dir>`

Absolute path to the pre-scaffolded clone project. Write all your output here.
The harness has already populated this directory with `package.json`,
`vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, and a
placeholder `src/App.tsx`, and has run `pnpm install`.

# Output

Your goal is to build a standalone prototype: a copy of the baseline app with design changes made on top. You will write that prototype into `<prototype_dir>`. It should look EXACTLY as if they opened the real application in the browser right now, but with a design change to address the design problem and approach found in `<conversations>`.

You are responsible for writing the application code into
`<prototype_dir>/src/` and getting `pnpm build` (run from
`<prototype_dir>`) to pass.

# Guidelines for making it look like the app in question

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

# 1. Write the code to make the app look the same as it does today, with the most relevant design change to solve the product problem

First find the source code for the overall app that you are prototyping off of. Then figure out the initial design change to be made. Then make that clone + design change on top in the `prototype_dir`.

Write all the code for the application into `src/`. Generate all TypeScript
code for the clone in one `.tsx` file (replacing the placeholder
`src/App.tsx`) and generate all CSS styles for the clone in one `.css`
file. This limits the number of tool calls required to generate the
application and reduces the likelihood of import errors.

# 2. Make the build pass

Keep running `pnpm build` (from the prototype directory) and fixing errors
until the build passes. The harness will run and tunnel the app once you
return.
