---
name: edit-content-script
description: >
  Edit a content script — a self-contained JavaScript file that can be injected into a running
  application to prototype a design idea without rebuilding.
model: sonnet
---

# Edit Content Script

The user left feedback on design directions in a canvas and wants to see those designs in their working app.

Your job is to write a content script that applies the requested design and functionality changes. Either create a new content script or edit an existing one from a previous prototype iteration.

A content script is a self-contained JavaScript IIFE that gets injected into a running web app
via `contentDocument` after the iframe has fully loaded (the page's own JS has already run).
It can mutate the DOM, inject CSS, and override `window.fetch` — but the app's initial fetches
have already completed by injection time. Fetch mocks intercept **subsequent** fetches triggered
when the content script navigates to a new route and the SPA re-renders.

## Understanding your plan inputs

You will receive a **plan item** with everything you need. The plan item contains:

- **`change_description`**: What to build or change.
- **`content_script`**: Attachment with a `url` field pointing to the existing content script
  from a previous prototype iteration. **This is the key field that determines your mode.** If
  set, download it and use Edit for targeted design changes to address the feedback. If null, there is no existing prototype — create a new content script from scratch.
- **`title`**: Title of the prototype.
- **`feedback`**: Array of user feedback comments that this prototype change addresses, each with:
  - `comment_text`: The user's feedback text.
  - `screenshot_url`: Screenshot with blue dot showing where the user clicked.
  - `image_urls`: Images the user attached (inspiration, desired outcomes).
  - `anchor_selectors`, `anchor_html`, `anchor_location`: DOM context where the comment was placed.
- **`reference_image_urls`**: URLs of mocks/designs on the canvas relevant to this change, that the change description might reference.

### How the plan item was resolved

The planner (Gemini) analyzed the full canvas and identified which prototype to revise and which
feedback to address. The MCP resolved everything into the plan item you receive:

- If there is a **source prototype** being revised, its content script is provided as an
  attachment in the `content_script` field. Download it from the URL and Edit it directly.
- If `content_script` is **null**, this is a new prototype with no prior content script to
  build on. Create one from scratch.
- **Reference images** are mocks or designs from the canvas that the planner determined are
  relevant. They are NOT the source prototype — they are visual context.
- **Feedback** is the user's comments that are being addressed, already resolved with screenshots, attached images, and DOM anchors.

Follow the `change_description` and use the feedback + images to understand what the design changes ask for.

### Image types

You will receive several types of images. Download and view ALL of them before writing code:

1. **Comment screenshots** (`screenshot_url`) — a screenshot of the canvas with a **blue dot**
   (white outline) marking where the user clicked to place their comment. This is the **primary
   ground truth** for what the user is referring to when they left important feedback. Pay attention to the blue dot for the placement of the comment, the screenshot itself may contain multiple mocks, but the blue dot can show you where the user left the comment and what mock or part of the design they specifically they were referring to.

2. **User-attached images** (`image_urls`) — images the user attached to their comment. These are
   typically inspiration screenshots, desired outcomes, or examples.

3. **Reference mocks** (`reference_image_urls`) — design mocks from the canvas that the planner
   determined are relevant to this change. These are contextual references, not always targets to
   match exactly. If the comment screenshots show multiple mocks, the reference mocks here are usually the ones that are actually relevant to the change.

   The comments and change_description determine how to use the reference mocks — read them together.

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

After, use these images and comment feedback to fully understand the change description and what changes the user wants to make.

**IMPORTANT:**
The reference mocks show a design direction, but they were made without full
knowledge of your app's actual UI. Don't replace the app's existing interface to match the mocks
pixel-for-pixel — instead, integrate the design idea into the app as it already exists. Only
build entirely new UI when the change truly requires a new surface (a new panel, modal, etc.).

Additionally, strive to keep the app fully functional. A user should see our design change but still use the full functionality of the application.

### Step 1: Determine your mode and read relevant code

Check the plan item's `content_script` field first — this determines everything:

- **`content_script` is set** → you are **editing** an existing prototype. Download it to the /tmp/ directory:
  ```
  curl -sL '<url>' -o /tmp/content_script_<slot_id>.js
  ```
- **`content_script` is null** → you are creating a **new** prototype from scratch.

Then read the existing content script (if any) and application source code relevant to the
change. Figure out:
- Which selectors to target (CSS class names, data attributes, component hierarchy)
- Which design tokens to reuse (colors, spacing, fonts) so the result looks integrated
- What specific DOM mutations you need to make to implement the change

Focus on the specific area the design idea targets — don't read the whole codebase. By the end
of this step you should have a clear plan for what to modify in Step 2.

### Step 2: Write or edit the content script

#### Mode A: New content script (`content_script` is null)

Write a new content script to the tmp directory: `/tmp/content_script_<slot_id>.js`. Follow this structure:

```javascript
(function contentScript() {
  "use strict";

  // -- constants (colors, selectors, SVG icons) --

  // -- setup: navigate, seed state --
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

#### Mode B: Edit existing content script (`content_script` is set)

Apply the requested design changes to the content script downloaded file at
`/tmp/content_script_<slot_id>.js`. Change what the feedback asks for.


#### Guidelines for both modes

**How the content script runs:** The script is injected after the page loads, so the DOM is
already rendered. It can override `window.fetch`, seed storage, navigate to a route, and wait
for elements to mutate the DOM. If you do mock fetches, mocks must be in place before
triggering the re-render that will use them.

**Think backward from what the design change needs to touch.** Which DOM elements, selectors,
and component structures must exist for your mutations to land? If the design change requires
data that the app won't have on its own (e.g., a notification count, search results), update
`setup()` to mock it.

**Keep the app fully functional.** Let the app run against its real backend. Only mock data when
the design change depends on something the backend won't reliably provide (specific data shapes,
search results, etc.). A user should be able to see the design change AND still use the rest of
the app normally. When you do mock, data must match the shapes and types the app expects —
no "Lorem ipsum" or placeholder text.

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

### Step 3: Upload and place on canvas

1. Use the `upload-file` skill to upload `/tmp/content_script_<slot_id>.js`.
2. Call the **softlight** MCP tool `update_iframe_element` with:
   - `project_id` — from the `<project_id>` tag in your prompt
   - `slot_id` — from the `<slot_id>` tag in your prompt
   - `title` — the plan item's `title`
   - `content_script_url` — the URL returned by the upload

### Step 4: Return

Return the **URL** of the uploaded content script and confirm the slot was updated.
