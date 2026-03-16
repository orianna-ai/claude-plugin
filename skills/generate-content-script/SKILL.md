---
name: generate-content-script
description: >
  Generate a content script that when run, puts an app into the right state to display a design issue with the application — navigated to the target screen, authenticated, and populated with realistic mock data.
model: sonnet
---

# Generate Content Script

You will receive context about a **design issue with an existing application** that the user wants to solve. Your goal is to write a content script that puts the app into the right screen and state to **see the problem with the app's design** — NOT to solve it. That state will later be screenshot.

Do not make any design changes. Just get the app showing the relevant page/state with realistic data so it can LATER be screenshot (you just write the content script).

The content script is a self-contained JavaScript IIFE injected into a running web app via
`Page.addScriptToEvaluateOnNewDocument`. It executes **before any of the page's own JavaScript**,
so fetch/WebSocket mocks and route changes must be set up synchronously during evaluation, not
deferred to `DOMContentLoaded`.

## Step 1: Identify the target app state

Figure out the **exact screen and state** that shows the app's design issue the user wants to solve. You should be able to describe it in one sentence (e.g. "the dashboard with three active projects and a notification badge" or "the checkout flow on the shipping step with items in the cart").

Read a small number of files to understand which screen is most relevant and how routing works.
Don't explore beyond what you need to answer: **what does the user need to see?**

## Step 2: Determine what the app needs to show this state

The screenshot tool navigates to `/` and captures what renders immediately. **Whatever 
renders at `/` when the app starts is the screenshot.** Make what loads there the app screen and state that displays the design problem, unconditionally.

Routing to the right page is only half the job. The page also needs to be in the right
**state**. Most components conditionally render based on app state — auth status, loaded data,
completed flow steps, selected tabs, expanded panels, etc. If any of these conditions aren't met,
the component will show a loading spinner, empty state, or redirect instead of the actual
content.

Find what the screen, state, and component reads to decide what to render, and make that true. Don't simulate the user flow — inject the end state as directly as possible.

The page must also have realistic mock data — enough that someone looking at the screenshot can immediately understand the design issue that is being presented.

**If any condition is not met, the screenshot will show a landing page, empty state, or login
screen — and the content script has failed.**

## Step 3: Write the content script

The content script runs via `Page.addScriptToEvaluateOnNewDocument` — it executes before any of
the app's own JavaScript. `setup()` runs synchronously at evaluation time to install mocks and
set state. `boot()` runs after DOMContentLoaded for any DOM mutations that need elements to
exist.

```javascript
(function contentScript() {
  "use strict";

  function setup() {
    // 1. Intercept fetch — mock API responses with realistic data
    // 2. Mock WebSocket / EventSource if the app uses them
    // 3. Seed localStorage/sessionStorage — auth, feature flags, preferences
    // 4. Navigate to the target route (use history.replaceState, not pushState)
  }

  setup();

  function waitForSelector(selector, root, timeout) {
    // helper: resolve when a selector appears in the DOM
  }

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

Mock data MUST match the shapes and types the app expects (plausible values, appropriate volume,
correct types — no "Lorem ipsum" or "Item 1"). If you are mocking images, use placeholder
images that will resolve and make sense.

**Rules:**

- IIFE wrapper — no global pollution
- `waitForSelector` with timeout — never hang
- Log warnings on failure — never throw or break the host app
- Run unconditionally — no conditionals or feature flags that skip setup

## Step 4: Upload and return

1. Write the content script to `/tmp/cs_1.js` (increment the number if the file already exists).
2. Upload the content script:
   ```
   curl -sf -F "file=@/tmp/cs_1.js" https://drive.orianna.ai/api/upload | tr -d '"'
   ```
3. **Delete the local `/tmp` file after a successful upload.** Do not leave content scripts in `/tmp`.
4. Return the uploaded URL as plain text.
