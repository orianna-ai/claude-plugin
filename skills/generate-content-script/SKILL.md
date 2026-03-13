---
name: generate-content-script
description: >
  Generate a content script that puts a running app into the right state for screenshotting the state for the design problem — navigated to the target screen, authenticated, and populated with realistic mock data.
model: sonnet
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE injected into a running web app via
`Page.addScriptToEvaluateOnNewDocument`. It executes **before any of the page's own JavaScript**,
so fetch/WebSocket mocks and route changes must be set up synchronously during evaluation, not
deferred to `DOMContentLoaded`.

You will receive context about the **design problem** the user is exploring. Your goal is to write a content script that makes the app show the CURRENT most relevant screen and state of the app for that problem, populated with realistic data, so it can be screenshotted.

## Step 1: Quick orientation
Determine the app where the screen and state exists, so the set up script targets the correct app.

Quickly understand the app by reading at most a small handful of files — start with README,
package.json, or the main entry point. If the user is redesigning a specific page or feature,
glance at that file too. Don't explore beyond that.

You need just enough context to answer:
- Which screen is most relevant to the design problem?
- How does routing work (file-based, React Router, etc.) so you can navigate there?

Then read the target page's component to understand what it needs to render: what data it
fetches, what auth/state it checks, and what conditions gate the content the user cares about.

## Step 2: Write the content script

Structure:

```javascript
(function contentScript() {
  "use strict";

  // setup() MUST run immediately — this script executes before any page JS,
  // so mocks and routing need to be in place synchronously.
  function setup() {
    // 1. Intercept fetch — mock API responses
    // 2. Mock WebSocket / EventSource if the app uses them
    // 3. Seed localStorage/sessionStorage — auth, feature flags, preferences
    // 4. Navigate to the target route (use history.replaceState, not pushState)
  }

  setup();

  function waitForSelector(selector, root, timeout) {
    // helper: resolve when a selector appears in the DOM
  }

  // DOM mutations that need elements to exist go here.
  function boot() {
    // optional: waitForSelector-based interactions (click a tab, expand a panel)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
```

### setup()

The screenshot tool loads `/` and captures what renders — no clicks, no inputs. Your content
script must make the target screen and state appear at `/`, fully populated with realistic data.

**Think backwards from the target view. What are the full chain of conditions that must be true for the target screen and state to render?** What is required before the target screen and state show the content you want? Each condition is something your content script must satisfy — pick the right technique for each one. Be exhaustive.

You'll typically need two things working together: (1) mock every fetch/API call so data is available instantly with no real backend needed, and (2) get the app into the right state to trigger the view you want (navigate to the right route, use the app's own URL params/deep links, or programmatically interact).

Mock data MUST match the shapes and types the app expects (plausible values, appropriate volume, correct types — no "Lorem ipsum" or "Item 1"). Additionally, add mock data to put the app in a state that is logical to show off the design problem. If you are mocking images, please use placeholder images that will resolve and make sense.

The content script must run unconditionally — don't add your own conditionals or feature flags
that would skip setup.

**If the screenshot shows a landing page, empty state, or login screen instead of the target
screen and state with real data, the content script has failed.** The whole point is to show the designsign problem in context. Ensure all the coniditons to show the design problem are met.

### Rules

- IIFE wrapper — no global pollution
- `waitForSelector` with timeout — never hang
- Log warnings on failure — never throw or break the host app

## Step 3: Upload and return

Write the content script to `/tmp/cs_1.js` (increment the number if the file already exists).
Then use the `upload-file` skill to upload it to Drive. Return the URL as plain text.
