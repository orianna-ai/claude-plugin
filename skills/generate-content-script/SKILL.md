---
name: generate-content-script
description: >
  Generate a content script that when run, puts an app into the right state to display a design issue with the application — navigated to the target screen, authenticated, and populated with realistic mock data.
model: sonnet
---

# Generate Content Script

You will receive context about a **design issue with an existing application** that the user wants to solve. Your goal is to write a content script that puts the app into the right screen and state to **see the problem with the app's design** — NOT to solve it. That state will later be screenshot.

Do not make any design changes. Just get the app showing the relevant page/state with realistic data so it can later be screenshot.

## How to think about content scripts

Think of a content script as **the `beforeEach` setup of a Playwright or Cypress E2E test — but running inline in the page instead of from an external test runner.** You are writing test fixtures, API mocks, and navigation setup — the same things you'd write to get an app into a specific state for a UI test.

The script is injected via `Page.addScriptToEvaluateOnNewDocument` and executes **before any of the page's own JavaScript**. This is equivalent to setting up `page.route()` handlers and `page.goto()` before the app loads.

| What you need to do | E2E test equivalent |
|---|---|
| Intercept `fetch` with mock responses | `page.route()` / `cy.intercept()` / MSW handlers |
| Seed localStorage/sessionStorage | Test fixtures / `beforeEach` setup |
| Navigate to target route | `page.goto('/dashboard')` |
| Wait for elements then interact | `await screen.findByRole(...)` / Playwright locators |
| "Never throw, never hang" | "Don't write flaky tests" |

## Step 1: Identify the target app state

Figure out the **exact screen and state** that shows the app's design issue the user wants to solve. You should be able to describe it in one sentence (e.g. "the dashboard with three active projects and a notification badge" or "the checkout flow on the shipping step with items in the cart").

Read a small number of files to understand which screen is most relevant and how routing works.
Don't explore beyond what you need to answer: **what does the user need to see?**

## Step 2: Determine what the app needs to show this state

The screenshot tool navigates to `/` and captures what renders immediately. **Whatever
renders at `/` when the app starts is the screenshot.** Make what loads there the app screen and state that displays the design problem, unconditionally.

### Enumerate every state dependency

Before writing any code, list every condition the target screen checks before rendering its real content. Think of these as the **test preconditions** you'd set up in a `beforeEach` block. Common ones:

- **Authentication** — token in localStorage/cookie, user profile endpoint returning a valid user. If you don't set this up, the app will redirect to login.
- **Route/URL** — the path, query params, and hash the page expects.
- **API data** — every `fetch`/`axios` call the page makes on mount. Check the component source for `useEffect`, `useQuery`, `useSWR`, `getServerSideProps`, loaders, etc. Each one is an endpoint you need to mock. **Mock every endpoint the page hits on load, not just the "main" one** — missing a single one causes loading spinners or error states.
- **Flow/wizard state** — completed steps, selected tabs, expanded panels stored in state or URL params.
- **Feature flags / preferences** — anything read from localStorage, cookies, or a flags endpoint.

If any condition is not met, the screenshot will show a landing page, empty state, loading spinner, or login screen — and the content script has failed.

### Plan your mocks like MSW handlers

For each API endpoint the target screen calls, determine:
- The exact URL pattern (including query params, trailing slashes, base URL prefixes)
- The expected response shape (read the component code to see what fields it destructures)
- Realistic mock data (correct types, plausible values, appropriate volume — no "Lorem ipsum" or "Item 1")

## Step 3: Write the content script

The synchronous portion is your fixture/mock setup (`beforeEach`); the `boot()` function is your post-load interactions.

`@testing-library/dom` and `@testing-library/user-event` are available as runtime dependencies. Import them dynamically via `esm.sh`:

```javascript
await import("https://esm.sh/@testing-library/dom");
await import("https://esm.sh/@testing-library/user-event");
```

Prefer these libraries over raw `querySelector` and `dispatchEvent` — they query by what the user sees (roles, text, labels) rather than class names that may be generated or unstable, and they simulate real user interactions that properly trigger framework state updates.

```javascript
(function contentScript() {
  "use strict";

  // ── Synchronous setup (runs before the app's JS) ──────────────

  // 1. Seed auth state
  localStorage.setItem("token", "mock-jwt-token");

  // 2. Navigate to the target route
  history.replaceState(null, "", "/target-route");

  // 3. Intercept fetch
  //    IMPORTANT: Always store the original fetch and pass through unmatched
  //    requests. If you don't, every endpoint you didn't mock will break.
  const _fetch = window.fetch;
  window.fetch = async (url, opts) => {
    const u = new URL(url, location.origin);

    if (u.pathname === "/api/me") {
      return new Response(JSON.stringify({ id: 1, name: "Jane Smith" }));
    }

    // ... other mocked endpoints ...

    // Pass through everything else to the real server
    return _fetch(url, opts);
  };

  // 4. Mock WebSocket / EventSource if the app uses them

  // ── Boot (runs after DOMContentLoaded) ─────────────────────────

  function waitForSelector(selector, root = document, timeout = 5000) {
    // Resolve when a selector appears in the DOM. Never hang.
  }

  function boot() {
    // Optional: waitForSelector-based interactions (click a tab, expand a panel)
    // Use testing-library queries (findByRole, findByText) when possible.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
```

### Common mistakes to avoid

These are flaky test anti-patterns — avoid them:

- **Incomplete mocks** — Missing an endpoint the page calls on mount. The page shows a spinner or error because you forgot to mock `/api/me` or a feature flags endpoint. Mock every endpoint, not just the main data one.
- **Wrong URL matching** — The app fetches `/api/v2/users?page=1` but you mock `/api/users`. Check how the app constructs URLs (base URL env vars, path prefixes, query params).
- **Wrong response shape** — The component destructures `data.items` but your mock returns `{ results: [...] }`. Read the component code to see what fields it accesses.
- **Missing auth** — The app checks auth on load and redirects before your route change takes effect. Seed auth state synchronously before anything else.
- **Arbitrary timeouts** — Using `setTimeout(2000)` instead of waiting for a condition. Use `waitForSelector` or MutationObserver.

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
