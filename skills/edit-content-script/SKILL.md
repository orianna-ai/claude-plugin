---
name: edit-content-script
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

## Understanding your plan inputs

You will receive a **plan item** with everything you need. The plan item contains:

- **`change_description`**: What to build or change.
- **`content_script`**: The full source code of the existing content script as inline text.
  **This is the key field that determines your mode.** If set, write it to a temp file and use
  Edit for targeted changes. If null, there is no existing prototype — create a new content
  script from scratch.
- **`title`**: Title of the prototype.
- **`feedback`**: Array of user feedback comments that this protoype change addresses, each with:
  - `comment_text`: The user's feedback text.
  - `screenshot_url`: Screenshot with blue dot showing where the user clicked.
  - `image_urls`: Images the user attached (inspiration, desired outcomes).
  - `anchor_selectors`, `anchor_html`, `anchor_location`: DOM context where the comment was placed.
- **`reference_image_urls`**: URLs of mocks/designs on the canvas relevant to this change, that the change description might reference.

### How the plan item was resolved

The planner (Gemini) analyzed the full canvas and identified which prototype to revise and which
feedback to address. The MCP resolved everything into the plan item you receive:

- If there is a **source prototype** being revised, its content script is provided inline in the
  `content_script` field. Write it to a temp file and Edit it directly.
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
   match exactly.

   The comments and change_description determine how to use the reference — read them together.

### DOM context

Feedback may include DOM anchor context (`anchor_selectors`, `anchor_html`, `anchor_location`) —
the DOM element the comment was anchored to. **Important caveat**: DOM anchors can be unreliable —
they sometimes point to a sibling element, a wrapper div, or are overly nested. Use the comment screenshots as the source of truth for *what* the user is pointing at, and the DOM context as a hint for *where in the code* to make changes. When they disagree, trust the screenshot.

## Workflow

### Step 0: Download and study the reference images and fully understand the proposed design change

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

After, use these images to fully understand the change description and what changes the user wants to make.

### Step 1: Determine your mode and read relevant code

Check the plan item's `content_script` field first — this determines everything:

- **`content_script` is set** → you are **editing** an existing prototype.
- **`content_script` is null** → you are creating a **new** prototype from scratch.

Then read the existing content script (if any) and application source code relevant to the change and plan your approach. Figure out:
- Which selectors to target (CSS class names, data attributes, component hierarchy)
- Which design tokens to reuse (colors, spacing, fonts) so the result looks integrated
- Which API endpoints the page calls and what shape mock data should take
- What specific DOM mutations you need to make to implement the change

Focus on the specific area the design idea targets — don't read the whole codebase. By the end
of this step you should have a clear plan for what to modify in Step 2.

### Step 2: Write or edit the content script

#### Mode A: New content script (`content_script` is null)

Write a new JavaScript file to the output path you chose in Step 1. Follow this structure:

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

#### Mode B: Iterate on existing content script (`content_script` is set)

Apply the requested changes to the existing script and write the result to a new file at
`/tmp/content_script_<slot_id>.js` (use the `slot_id` from the `<slot_id>` tag in your prompt).

FOR BOTH MODES, FOLLOW THESE GUIDELINES:

**Setting up initial conditions:**

**Think backward from what the updated prototype needs to show.** What conditions must be true
for the target view to render correctly with the design change applied? Each condition is
something `setup()` must satisfy — navigation to the right route, mock data for the right
endpoints, the right app state.

If you're editing an existing content script, re-evaluate its `setup()` given the new design
change. Does it still navigate to the right page? Does it mock the right data? Does the change
require new or different mock data, a different route, or different app state? Update `setup()`
if needed, preserve it if it's already correct.

Mock data MUST match the shapes and types the app expects (plausible values, appropriate volume,
correct types — no "Lorem ipsum" or "Item 1"). Additionally, add mock data to put the app in a
state that is logical to show off the design change. If you are mocking images, please use
placeholder images that will resolve and make sense.

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

### Step 3: Place on canvas

Call the **softlight** MCP tool `update_iframe_element` with:

- `project_id` — from the `<project_id>` tag in your prompt
- `slot_id` — from the `<slot_id>` tag in your prompt
- `title` — the plan item's `title`
- `content_script` — the full content of the script you wrote or edited

### Step 4: Return

Return the **file path** of the content script and confirm the slot was updated.
