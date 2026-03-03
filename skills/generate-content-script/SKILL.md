---
name: generate-content-script
description: >
  Generate a content script — a self-contained JavaScript file that can be injected into a running
  application to prototype a design idea without rebuilding.
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE that gets injected into a running web app.
It mutates the DOM, injects CSS, and patches behavior to prototype a design idea without
touching the source or rebuilding.

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

### Step 1: Read the application source code

Read the source code of the components and pages relevant to the design idea. From the source
you can learn:
- CSS class names and data attributes to use as selectors
- Component hierarchy and how elements are nested
- Stylesheets and design tokens (colors, spacing, fonts) to match the app's visual language
- Which API endpoints the page calls and what shape the responses should be

Focus on the specific area the design idea targets — don't read the whole codebase. Keep it
minimal and focused. Don't refactor or "improve" unrelated parts of the app.

### Step 2: Write the content script

Write a single JavaScript file that follows this structure:

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

**Setting up initial conditions:**

The `setup()` function runs before any mutations. It should always be included.

**Navigate to the right page — this is critical.** The design idea targets a specific page or
view. The `setup()` function must navigate there before anything else runs. For SPAs, call
`history.pushState(null, "", "/target/route")` and dispatch a `popstate` event so the
client-side router picks it up. For multi-page apps, set `window.location.href`. If the app
is already on the right page, skip this step.

**Mock API data — this is critical.** The app is running without a real backend, so pages will
load blank or error out without mock data. Intercept `fetch` to return realistic mock data for
every endpoint the page calls. Read the source to find which API endpoints are used and what
shape the responses should be. Store the original `fetch` and call through for non-intercepted
requests.

**The mock data must match the reference images.** Study the screenshots to understand what
kind of data the app displays and how it's structured. Your mock data should feel like it
belongs in the same app — same types of fields, realistic values, and appropriate volume.
Generic "Lorem ipsum" or "Item 1, Item 2" placeholders are wrong.

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

Return the content script as a string. The caller handles placement.
