---
name: generate-content-script
description: >
  Generate a content script that puts a running app into the right state for screenshotting the state for the design problem — navigated to the target screen, authenticated, and populated with realistic mock data.
model: sonnet
---

# Generate Content Script

Generate the content script fast — the user wants to see the direction ASAP.

A content script is a self-contained JavaScript IIFE injected into a running web app. It runs
before the app's own code renders, intercepting fetch calls, seeding storage, and pushing routes
so the app's own components render the target screen in the right state.

You will receive context about the **design problem** the user is exploring. Your goal is to get
the app showing the most relevant screen and state of the app for that problem — populated with
realistic data — so it can be screenshotted.

## Step 1: Quick orientation

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

  function setup() {
    // 1. Intercept fetch — mock API responses
    // 2. Seed localStorage/sessionStorage — auth, feature flags, preferences
    // 3. Navigate to the target route
  }

  function waitForSelector(selector, root, timeout) {
    // helper: resolve when a selector appears in the DOM
  }

  function boot() {
    setup();
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

The screenshot tool navigates to `/` and captures what renders — no clicks, no inputs, no query
params. The content script must make the target screen render unconditionally at `/`, fully
populated with realistic data.

Routing to the right page is only half the job. The page also needs to be in the right **state**.
Most components conditionally render based on app state — auth status, loaded data, completed
flow steps, selected tabs, expanded panels. If any of these conditions aren't met, the component
will show a loading spinner, empty state, or redirect instead of the actual content.

**1. Intercept fetch and return mock data.**
This is the most important step. Intercept `fetch` (or `XMLHttpRequest`) before any app code
runs. Return realistic mock data for every endpoint the target page calls. Store the original
`fetch` and call through for requests you don't need to mock. Your mock data must match the
shape the app expects — wrong field names, wrong types, or missing fields will cause the
component to crash or render blank. Use plausible values and appropriate volume (real-looking
names, enough items to fill the screen). No "Lorem ipsum" or "Item 1, Item 2".

**2. Bypass auth.**
Mock the auth endpoint, seed a token/session in localStorage, or set whatever state the app's
auth guard checks. If the app wraps routes in an auth provider, make sure the provider resolves
to an authenticated state.

**3. Satisfy every rendering condition.**
If the component gates on selected tab, completed onboarding, feature flag, loaded state,
expanded panel, or similar — seed the right value. Techniques:
- Seed localStorage/sessionStorage (feature flags, preferences, onboarding state)
- Intercept the specific fetch call that loads the gating data
- Programmatic clicks/inputs via `waitForSelector` (e.g., clicking a tab)

**4. Route to the target screen.**
SPAs: `history.pushState(null, "", "/target/route")` + dispatch `popstate` so the client-side
router picks it up. MPAs: `window.location.href`.

Do NOT gate setup behind URL params, feature flags, or conditionals.

### Rules

- IIFE wrapper — no global pollution
- `waitForSelector` with timeout — never hang
- Log warnings on failure — never throw or break the host app

## Step 3: Return

Return the content script as a string.
