---
name: generate-content-script
description: Generate a content script — a self-contained JavaScript file that can be injected into a running application to prototype a design idea without rebuilding.
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE that gets injected into a running web app. It
mutates the DOM, injects CSS, and patches behavior to prototype a design idea without touching the
source or rebuilding.

You MUST follow all steps in order. Some steps can be skipped in initial setup mode — each step says when.

## Step 0: Determine your mode

You will be called in one of two ways. Check what you received:

**Mode: Initial setup** — You received an **application analysis** and a general description, but
no plan item. Your job is to write a content script that gets the app into a good default state —
navigated to the right page, mock data loaded, auth bypassed — so it renders cleanly for
screenshots. There is no design change to make; just get the app rendering.

**Mode: Plan item** — You received a structured **plan item** with a `change_description` and
possibly an existing `content_script`, feedback, and reference images. Follow every step below.

---

## Step 1: Understand your inputs

*Skip this step if you are in initial setup mode and did not receive a structured plan item.*

The plan item contains:

- **change_description**: What to build or change.
- **content_script**: The full source code of the existing content script as inline text. This is
  the key field that determines whether you edit or create from scratch. If set, write it to a temp
  file and use Edit for targeted changes. If null, create a new content script.
- **title**: Title of the prototype.
- **slot_id**: Slot ID of the existing prototype being revised (if any).
- **feedback**: Array of user feedback comments, each with:
  - `comment_text`: The user's feedback text.
  - `screenshot_url`: Screenshot with blue dot showing where the user clicked.
  - `image_urls`: Images the user attached (inspiration, desired outcomes).
  - `anchor_selectors`, `anchor_html`, `anchor_location`: DOM context where the comment was placed.
- **reference_image_urls**: URLs of mocks/designs on the canvas relevant to this change.
- An **application analysis** — selectors, design tokens, component structure, API shapes, routing.

### How the plan item was resolved

The planner analyzed the full canvas and identified which prototype to revise and which feedback to
address. The MCP resolved everything into the plan item you receive:

- If there is a source prototype being revised, its content script is provided inline in the
  `content_script` field. Write it to a temp file and Edit it directly.
- Reference images are mocks or designs from the canvas that the planner determined are relevant.
  They are NOT the source prototype — they are visual context.
- Feedback is the user's comments, already resolved with screenshots, attached images, and DOM
  anchors.

You do not need to figure out which prototype to edit or which comments to address — that has
already been decided. Just follow the `change_description` and use the feedback + images to
understand what the user wants.

### Image types

You will receive several types of images. Download and view ALL of them before writing code:

**Comment screenshots** (`screenshot_url`) — a screenshot of the canvas with a blue dot (white
outline) marking where the user clicked to place their comment. This is the primary ground truth for
what the user is referring to. Use it to understand what part of the UI the feedback targets.

**User-attached images** (`image_urls`) — images the user attached to their comment. These are
typically inspiration screenshots, desired outcomes, or examples. Treat them as the user saying
"make it look like this."

**Reference mocks** (`reference_image_urls`) — design mocks from the canvas that the planner
determined are relevant to this change. These are contextual references, not always targets to match
exactly. Depending on the feedback, a reference mock might be:

- A design the user wants the prototype to look like ("make it match this mock")
- A baseline the user is giving feedback on ("this is what we started from, here's what to change")
- Visual context for understanding the user's intent ("the nav in this mock shows what they mean")

The comments determine how to use the reference — read them together.

### DOM context

Feedback may include DOM anchor context (`anchor_selectors`, `anchor_html`, `anchor_location`) —
the DOM element the comment was anchored to. Important caveat: DOM anchors can be unreliable — they
sometimes point to a sibling element, a wrapper div, or are overly nested. Use the comment
screenshots as the source of truth for what the user is pointing at, and the DOM context as a hint
for where in the code to make changes. When they disagree, trust the screenshot.

## Step 2: Analyze reference images

*Skip this step if you are in initial setup mode and did not receive a structured plan item.*

Run the `analyze-images` skill on all provided image URLs — comment screenshots, user-attached
images, and reference mocks. Study every image before writing code — they are ground truth for
layout, visual style, content, and component patterns.

Use these images to understand the intent and visual direction. Prefer leveraging existing app UI
(drawers, modals, tabs, panels) over injecting new DOM. Generic placeholder UI is not acceptable.

## Step 3: Read relevant code

Use the **application analysis** for selectors, tokens, and API shapes. Read source files from the
analysis only if you need more detail on a specific component.

## Step 4: Write or edit the content script

If you are in **initial setup mode**, write a [new content script](#writing-a-new-content-script).

If you have a **plan item**, check the `content_script` field:

- **`content_script` is set** → [edit the existing content script](#editing-an-existing-content-script).
- **`content_script` is null** → write a [new content script](#writing-a-new-content-script).

### Writing a new content script

Write a new JavaScript file to `/tmp/content_script.js`. Follow this structure:

```javascript
(function contentScript() {
  "use strict";

  // -- constants (colors, selectors, SVG icons) --

  // -- setup: mock data, navigate, seed state --
  function setup() { ... }

  // -- inject <style> with all CSS --
  var style = document.createElement("style");
  style.textContent = "...";
  document.head.appendChild(style);

  // -- helper: wait for a selector to appear --
  function waitForSelector(selector, root, timeout) { ... }

  // -- mutation functions (one per change) --
  async function injectFeatureA() { ... }
  async function injectFeatureB() { ... }

  // -- boot --
  function boot() {
    setup();
    injectFeatureA().catch(function(e) {
      console.warn("[content_script]", e.message);
    });
    injectFeatureB().catch(function(e) {
      console.warn("[content_script]", e.message);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
```

### Editing an existing content script

Apply the requested changes to the existing script and write the result to a new file at /tmp/content_script_<slot_id>.js. Change only what the feedback asks for. Preserve everything else — working code, mock data, structure, unaffected mutations.

## Step 5: setup()

**Every content script — new or edited — must have a fully working `setup()`.** Without it the page
will render blank or error out and the screenshot will be empty. If you are editing a content script
and need more mock data, add it to the existing setup.

The screenshot tool navigates to `/` and captures what renders — no clicks, no inputs, no query
params. The content script must make the target screen render unconditionally at `/`, fully
populated with realistic data.

**Routing.** SPAs: `history.pushState(null, "", "/target/route")` + dispatch `popstate`. MPAs:
`window.location.href`.

**Mock API data.** Intercept `fetch` to return realistic mock data. Store the original and call
through for unmocked requests. This is important, the UI should be in a state where the user can
understand the design change.

**Match reference images.** Mock data must use realistic values and appropriate volume matching
the screenshots. No "Lorem ipsum" or "Item 1, Item 2".

**Bypass auth.** Mock the auth endpoint, seed a token in localStorage, or set whatever state the
app checks.

**Satisfy rendering conditions.** Components gate on auth status, loaded data, flow steps,
selected tabs. Use the application analysis to identify and satisfy every condition.

Other techniques:
- Seed localStorage/sessionStorage (feature flags, preferences, onboarding state)
- Programmatic clicks/inputs via `waitForSelector`

Do NOT gate setup behind URL params, feature flags, or conditionals.

### Rules

- IIFE wrapper — no global pollution
- All CSS in one injected `<style>` tag; prefix classes with `cs-`
- `MutationObserver` for dynamically rendered elements
- `waitForSelector` with timeout — never hang
- One function per distinct change — fail independently
- Log warnings on failure — never throw or break the host app
- Match the app's visual language from the application analysis and reference images

## Step 3: Return
Return the file path of the content script you wrote or edited. The caller reads the file and handles placement.
