---
name: generate-initial-prototype
description: "Clone elements of an existing application and layer on a design change to solve a design problem in a prototype."
---

# Input

## `<spec>`

A PRD/design brief for the prototype. This is the implementation brief. Follow it closely.

## `<prototype_dir>`

Absolute path to the pre-scaffolded clone project. Write all your output here.
The harness has already populated this directory with `package.json`,
`vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, and a
placeholder `src/App.tsx`, and has run `pnpm install`.

# Output

Your goal is to build a standalone prototype: a copy of the baseline app with design changes made on top. You will write that prototype into `<prototype_dir>`.

It should look EXACTLY as if they opened the real application in the browser right now, but with a design change to address the design problem and approach found in `<spec>`.

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
UI — how it looks TODAY for the parts that are not represented in the design change. For the design change, make it look like it is part of the app (use the design system).

# Apply baseline design taste

The decision and the framing you pass downstream should respect these defaults. They are
grounded primarily in Luke Wroblewski's research and writing at [lukew.com](https://www.lukew.com/) —
the canonical practitioner reference for forms, primary actions, visual organization, response
time, and progressive feedback. Use them to rule out non-decisions (which usually have one
obvious answer once you name the pattern) and to give the sketching agent shared vocabulary.

- **Hierarchy** — take an opinion. Catalogue the information and actions on the screen, then
  rank them: primary, secondary, tertiary. LukeW's framing: the primary action carries
  stronger visual weight than every other element on the screen and "illuminates a path" for
  the user toward completion. Secondary actions get less weight so they don't compete; rarely-
  used tertiary actions can be hidden until needed. Use size, contrast, placement, and spacing
  to encode importance — not just color. Sketches should make it obvious what the user sees
  first, second, third.
  Sources: [LukeW — Primary & Secondary Actions in Web Forms](https://www.lukew.com/ff/entry.asp?571=),
  [LukeW — Previous and Next Actions in Web Forms](https://www.lukew.com/ff/entry.asp?730),
  [LukeW — Visible Narratives: Understanding Visual Organization](https://www.lukew.com/ff/entry.asp?981),
  [LukeW — The Three Aspects of Visual Design](https://www.lukew.com/ff/entry.asp?42=).

- **Form validation and feedback** — show feedback as a two-way conversation, not a post-hoc
  audit. LukeW's research with Etre (2009) on inline validation found real-time feedback on
  blur improved success rates by 22%, cut errors by 22%, raised satisfaction by 31%, and cut
  completion time by 42%. Rules that hold up:
  - Field-level errors live next to the field that caused them, in plain language, with the
    fix stated.
  - Trigger on blur, not on every keystroke. First keystrokes are always "invalid"; that
    interruption is hostile.
  - State constraints (length, format, required fields) up front so the user knows the rules
    before they type — don't reveal them only on failure.
  - For long or sensitive forms, real-time feedback also confirms *valid* answers, not just
    flags errors.
  Sources: [LukeW — Testing Real Time Feedback in Web Forms (Etre study)](https://www.lukew.com/ff/entry.asp?883=),
  [LukeW — Inline Validation in Web Forms (A List Apart)](https://alistapart.com/article/inline-validation-in-web-forms/),
  [LukeW — Web Form Design: Best Practices (PDF)](https://static.lukew.com/webforms_lukew.pdf),
  [LukeW — Web Form Design (book)](https://www.lukew.com/resources/web_form_design.asp).

- **Loading and progress** — focus on progress, not waiting. LukeW's argument: spinners draw
  attention to the clock ticking down. Skeleton screens and content-first transitions draw
  attention to what's about to appear. Match the indicator to the wait:
  - **< 1s**: no indicator. Looped animations under a second add noise without information.
  - **1–10s, content with known shape** (lists, cards, dashboards, detail pages): skeleton
    screen — communicates *what* is loading, not just *that* something is loading.
  - **2–10s, contextual or in-component** (button save, auth, payment): inline spinner.
  - **> 10s**: determinate progress bar with percentage, step count, or estimated time.
    Indeterminate spinners past 10s make users doubt the system is still working.
  Sources: [LukeW — Mobile Design Details: Avoid The Spinner](https://www.lukew.com/ff/entry.asp?1797=),
  [LukeW — Web Form Design: Best Practices (PDF)](https://static.lukew.com/webforms_lukew.pdf).

- **Modals / overlays** — reserve for consequential, actionable decisions: destructive or
  irreversible actions, risk of data loss, focused tasks that must be completed or abandoned
  before continuing. LukeW's "Overlays in Web Forms" gives concrete examples (additional
  inputs, confirmation flows, secondary tasks) and is clear that overlays should *not*
  replace a real screen for primary tasks. Never use a modal for navigation or purely
  informational content.
  Sources: [LukeW — Overlays in Web Forms](https://www.lukew.com/ff/entry.asp?999=),
  [LukeW — Inline Contextual Actions](https://www.lukew.com/ff/entry.asp?246).

- **Toasts / snackbars** — brief, non-interruptive feedback the user does not have to act on
  (saved, sent, copied, undo-after-action). Never for errors that need action, never for
  content the user must read to continue. LukeW's framing of feedback as a "two-way
  conversation" applies here too: a toast is a confirmation, not a place to hide a problem.
  If the message has two or more actions, or it's important enough to block the screen, it's
  not a toast — it's a dialog.
  Sources: [LukeW — Web Form Design: Best Practices (PDF, "feedback and confirmation")](https://static.lukew.com/webforms_lukew.pdf),
  [Material 3 — Snackbar guidelines (for component-level rules LukeW doesn't cover)](https://m3.material.io/components/snackbar/guidelines).

- **Empty states / the creation chasm** — turn a blank screen into a path forward. LukeW
  frames this as "the creation chasm" — the gap between an empty document/list/canvas and
  the user's first useful action. The job of an empty state is to bridge that chasm with a
  clear explanation of what will appear here and a prominent primary action that unblocks the
  user. If there are multiple options, one is unambiguously primary. An empty state without a
  next step is a bug.
  Sources: [LukeW — Let the AI do the Onboarding (the creation chasm)](https://www.lukew.com/ff/entry.asp?2130=),
  [LukeW — Tackling Common UX Hurdles with AI](https://www.lukew.com/ff/entry.asp?2132=),
  [LukeW — articles tagged Onboarding](https://www.lukew.com/ff?tag=onboarding).

- **Realistic density** — design with real content, across the full spectrum: empty → few →
  many → overflow. LukeW's argument: dummy data and Lorem Ipsum are a veil between the
  designer and reality — an elegant mock can quickly bloat with unexpected content or break
  under the weight of actual activity. Use real (or LLM-generated, plausible) content so the
  sketch reflects what the app must endure: long names, missing fields, seven columns instead
  of five, fifty rows instead of three. Stress-test the layout with the messy version of the
  data, not the photoshoot version.
  Sources: [LukeW — Death to Lorem Ipsum](https://www.lukew.com/ff/entry.asp?927=),
  [LukeW — The Death of Lorem Ipsum (AI-era update)](https://www.lukew.com/ff/entry.asp?2071=),
  [Basecamp — Getting Real: Use Real Words](https://basecamp.com/gettingreal/11.4-use-real-words).
- **Relevant states** — include empty / error / in-progress states only when they meaningfully
  change the decision being explored. Don't dilute the sketch with states that don't move the
  question forward.

# Workflow

# 1. Write the code to make the app look the same as it does today, with the most relevant design change to solve the product problem

First find the source code for the overall app that you are prototyping off of. Then figure out the initial design change from `<spec>`. Then make that clone + design change on top in the `prototype_dir`.

Write all the code for the application into `src/`. Generate all TypeScript
code for the clone in one `.tsx` file (replacing the placeholder
`src/App.tsx`) and generate all CSS styles for the clone in one `.css`
file. This limits the number of tool calls required to generate the
application and reduces the likelihood of import errors.

# 2. Make the build pass

Keep running `pnpm build` (from the prototype directory) and fixing errors
until the build passes. The harness will run and tunnel the app once you
return.
