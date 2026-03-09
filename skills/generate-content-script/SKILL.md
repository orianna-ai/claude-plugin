---
name: generate-content-script
description: >
  Generate a content script — a self-contained JavaScript file that can be injected into a running
  application to prototype a design idea without rebuilding.
model: sonnet
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE that gets injected into a running web app.
It mutates the DOM, injects CSS, and patches behavior to prototype a design idea without
touching the source or rebuilding.

## Understanding your inputs

You will receive a **plan item** with everything you need. The plan item contains:

- **`change_description`**: What to build or change.
- **`content_script_path`**: An absolute file path (e.g. `/tmp/content_script_src_abc123.js`)
  to the existing content script, already written to disk by the MCP. Each plan item gets its
  own unique file. **This is the key field that determines your mode.** If set, the file
  exists — Read it and use Edit for targeted changes. If null, there is no existing prototype —
  create a new content script from scratch at the output path.
- **`title`**: Title of the prototype.
- **`slot_id`**: Slot ID of the existing prototype being revised (if any).
- **`feedback`**: Array of user feedback comments, each with:
  - `comment_text`: The user's feedback text.
  - `screenshot_url`: Screenshot with blue dot showing where the user clicked.
  - `image_urls`: Images the user attached (inspiration, desired outcomes).
  - `anchor_selectors`, `anchor_html`, `anchor_location`: DOM context where the comment was placed.
- **`reference_image_urls`**: URLs of mocks/designs on the canvas relevant to this change.

### How the plan item was resolved

The planner (Gemini) analyzed the full canvas and identified which prototype to revise and which
feedback to address. The MCP resolved everything into the plan item you receive:

- If there is a **source prototype** being revised, its content script was written to a temp file
  at `content_script_path`. This is the starting point — Read it and Edit it directly.
- **Reference images** are mocks or designs from the canvas that the planner determined are
  relevant. They are NOT the source prototype — they are visual context.
- **Feedback** is the user's comments, already resolved with screenshots, attached images, and
  DOM anchors.

You do not need to figure out which prototype to edit or which comments to address — that has
already been decided. Just follow the `change_description` and use the feedback + images to
understand what the user wants.

### Image types

You will receive several types of images. Download and view ALL of them before writing code:

1. **Comment screenshots** (`screenshot_url`) — a screenshot of the canvas with a **blue dot**
   (white outline) marking where the user clicked to place their comment. This is the **primary
   ground truth** for what the user is referring to. Use it to understand *what part of the UI*
   the feedback targets.

2. **User-attached images** (`image_urls`) — images the user attached to their comment. These are
   typically inspiration screenshots, desired outcomes, or examples. Treat them as the user saying
   "make it look like this."

3. **Reference mocks** (`reference_image_urls`) — design mocks from the canvas that the planner
   determined are relevant to this change. These are contextual references, not always targets to
   match exactly. Depending on the feedback, a reference mock might be:
   - A design the user wants the prototype to **look like** ("make it match this mock")
   - A baseline the user is **giving feedback on** ("this is what we started from, here's what to change")
   - Visual context for understanding the user's intent ("the nav in this mock shows what they mean")

   The comments determine how to use the reference — read them together.

### DOM context

Feedback may include DOM anchor context (`anchor_selectors`, `anchor_html`, `anchor_location`) —
the DOM element the comment was anchored to. **Important caveat**: DOM anchors can be unreliable —
they sometimes point to a sibling element, a wrapper div, or are overly nested. Use the comment screenshots as the source of truth for *what* the user is pointing at, and the DOM context as a hint for *where in the code* to make changes. When they disagree, trust the screenshot.

## Workflow

### Step 0: Download and study the reference images

You will receive URLs for reference screenshots and/or design direction mocks. **Download
each image and view it before doing anything else.** The URLs are text strings in your
prompt — you cannot see the images without downloading them.

For each image URL, run:

```
curl -sL "<url>" -o /tmp/ref_<N>.png
```

Then use the **Read** tool on the downloaded file (e.g. `Read /tmp/ref_1.png`). The Read
tool displays images visually so you can inspect them. Do this for every image URL — do not
skip any.

Study them carefully before writing any code. These images are your ground truth for:
- **Layout**: how elements are arranged, spacing, alignment, visual hierarchy
- **Visual style**: color palette, typography, backgrounds, light vs dark theme
- **Content**: what kind of data is shown and how it's formatted
- **Components**: which UI patterns are used (tables, cards, charts, nav bars, etc.)

Your content script must produce output that **visually resembles these screenshots** with the
design idea applied on top. Match the overall look and feel — theme, palette, density, and
component style. Generic placeholder UI that ignores the reference images is not acceptable.

### Step 1: Determine your mode and read relevant code

Check the plan item's `content_script_path` field first — this determines everything:

- **`content_script_path` is set** → you are **editing** an existing prototype. Read the file
  at that path immediately so you understand what's already built before reading anything else.
- **`content_script_path` is null** → you are creating a **new** prototype from scratch. You must find an unsed content_script_path to write to. 

Then read the application source code relevant to the change and plan your approach. Figure out:
- Which selectors to target (CSS class names, data attributes, component hierarchy)
- Which design tokens to reuse (colors, spacing, fonts) so the result looks integrated
- Which API endpoints the page calls and what shape mock data should take
- What specific DOM mutations you need to make to implement the change

Focus on the specific area the design idea targets — don't read the whole codebase. By the end
of this step you should have a clear plan for what to modify in Step 2.

### Step 2: Write or edit the content script

#### Mode A: New content script (`content_script_path` is null)

Write a new JavaScript file to the new file pathy you found earlier. Again, you are to find a new file path to write to: /tmp/content_script_UNIQUEID.js Follow this structure:

```javascript
(function contentScript() {
  "use strict";

  // -- constants (colors, selectors, SVG icons) --

  // -- setup: mock data, navigate, seed state --
  function setup() { ... }

  // -- inject a <style> tag with all CSS --
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

#### Mode B: Iterate on existing content script (`content_script_path` is set)

Use the **Edit** tool for targeted modifications. Change only what the feedback asks for.
Preserve everything else — working code, mock data, structure, unaffected mutations.

Do not rewrite the script from scratch. The whole point is to make cheap, targeted edits.

FOR BOTH MODES, FOLLOW THESE GUIDELINES:

**Setting up initial conditions:**

The `setup()` function runs before any mutations. It should always be included.

**Navigate to the right page — this is critical.** The design idea targets a specific page or
view. The `setup()` function must navigate there before anything else runs. For SPAs, call
`history.pushState(null, "", "/target/route")` and dispatch a `popstate` event so the
client-side router picks it up. For multi-page apps, set `window.location.href`. If the app
is already on the right page, skip this step.

**Mock API data when needed — this is critical.** The app may or may not have a working backend. If pages load
blank or error out, intercept `fetch` to return realistic mock data for the failing endpoints.
Read the source to find which API endpoints are used and what shape the responses should be.
Store the original `fetch` and call through for requests you don't need to mock.

**Mock data must match the reference images.** Study the screenshots to understand what kind of
data the app displays and how it's structured. Your mock data should feel like it belongs in the
same app — same types of fields, realistic values, and appropriate volume. Generic "Lorem ipsum"
or "Item 1, Item 2" placeholders are wrong.

Other techniques:

- **Seed localStorage / sessionStorage.** Set values the app reads on mount — feature flags,
  user preferences, onboarding state.
- **Programmatic interaction.** Click buttons, fill inputs, or toggle switches to drive the app
  into the desired state. Use `waitForSelector` to wait for elements to mount first.

**Rules:**

- Wrap everything in an IIFE to avoid polluting the global scope.
- All CSS goes in a single injected `<style>` tag. Prefix class names with `cs-` to avoid
  collisions with the app's own styles.
- Use `MutationObserver` when targeting elements rendered dynamically (e.g. React components
  that mount after route changes).
- Use `waitForSelector` with a timeout so the script doesn't hang if the structure changes.
- Each distinct change should be its own function so it fails independently.
- Log warnings to console on failure — never throw or break the host app.
- Match the app's existing visual language (fonts, colors, spacing, border radii) so the
  prototype looks integrated. Use the reference screenshots as the source of truth — if the
  app has a dark theme, your injected CSS must use dark backgrounds. If it uses specific accent
  colors, reuse them.

### Step 3: Return

Return the **file path** of the content script — `content_script_path` for iterations, or the
output path for new prototypes. The caller reads the file and handles placement.
