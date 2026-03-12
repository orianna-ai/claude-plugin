---
name: generate-content-script
description: Generate a content script — a self-contained JavaScript file that can be injected into a running application to prototype a design idea without rebuilding.
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE injected into a running web app. It mutates
the DOM, injects CSS, and patches behavior to prototype a design idea without touching source or
rebuilding.

You will receive:
- A **design direction** (what to change)
- An **application analysis** — selectors, design tokens, component structure, API shapes, routing
- **Reference image URLs** for screenshots and/or design direction mocks

## Step 1: Analyze reference images

Run the `analyze-images` skill on all provided image URLs. Study every image before writing code —
they are ground truth for layout, visual style, content, and component patterns.

Your content script must visually match these images with the design idea applied on top. Generic
placeholder UI is not acceptable.

## Step 2: Write the content script

Use the application analysis for selectors, tokens, and API shapes. Read source files from the
analysis only if you need more detail on a specific component.

Structure:

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

### setup()

The screenshot tool navigates to `/` and captures what renders — no clicks, no inputs, no query
params. The content script must make the target screen render unconditionally at `/`, fully
populated with realistic data.

**Routing.** SPAs: `history.pushState(null, "", "/target/route")` + dispatch `popstate`. MPAs:
`window.location.href`.

**Mock API data.** Intercept `fetch` to return realistic mock data. Store the original and call
through for unmocked requests.

**Bypass auth.** Mock the auth endpoint, seed a token in localStorage, or set whatever state the
app checks.

**Satisfy rendering conditions.** Components gate on auth status, loaded data, flow steps,
selected tabs. Use the application analysis to identify and satisfy every condition.

**Match reference images.** Mock data must use realistic values and appropriate volume matching
the screenshots. No "Lorem ipsum" or "Item 1, Item 2".

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

Return the content script as a string.
