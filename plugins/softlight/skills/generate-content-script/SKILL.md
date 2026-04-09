---
name: generate-content-script
description: >
  Generate a content script - a self-contained JavaScript file that is injected into a running
  application in order to preview a change to an application without having to modify and rebuild
  the application itself.
---

# Input

## `<workspace>`

Absolute path to the application source tree. All references to "the application" in this skill
mean the code rooted at `<workspace>` — use it to inspect the existing design system, component
library, CSS classes, and DOM output you need to match or interact with. Scope all file exploration
and reads to files under this directory; do not read files outside it.

## `<path>`

Path at which to write the generated content script.

## `<spec>`

Specification of the change to the application to implement in the content script.

# Output

Write a content script that implements `<spec>` and save it to `<path>`. Do not output anything.

## Guidelines

- Wrap everything in a strict-mode IIFE. This script is injected before the application's own
  bundle, so synchronous code at the top-level (e.g., auth, routing, mocks) take effect before the
  application boots.

  ```js
  (function() {
    "use strict";

    // your code here — runs immediately, in strict mode
  })();
  ```

- You may reference any third-party dependencies available through `esm.sh`.

  ```js
  (function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    function init() {
      import('https://esm.sh/@testing-library/dom').then(function (module) {
        var screen = module.screen;

        var button = screen.getByRole('button', { name: /submit/i });
        button.click();
      });
    }
  })();
  ```

- If the `<spec>` requires the app to open on a specific page or tab, rewrite the URL with
  `history.replaceState` at the top of the content script before any other code runs. Because the
  content script runs before the framework boots, the router will initialize into the right state.

  ```js
  (function () {
    "use strict";

    // Navigate to the desired tab before the framework boots
    history.replaceState(null, "", "/app/usage-events");

    // rest of script...
  })();
  ```

- Do not assume the application starts with sufficient data to demonstrate the `<spec>`. Always
  mock `fetch` to provide realistic, representative data that demonstrates the `<spec>` effectively.
  The mock should intercept relevant API endpoints and return rich, diverse sample data (varied
  timestamps, multiple users/entities, realistic distributions) so the UI looks compelling and
  functional. Fall through to the original `fetch` for any endpoints you are not mocking. When
  mocking `fetch`, you must handle `input instanceof Request` and you should verify how the
  application constructs the `input` argument - applications that are built with Vite, for example,
  will prepend `VITE_API_URL` to the `input`.

  ```js
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/mock-endpoint")) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }
    return originalFetch.call(this, input, init);
  };
  ```

- When modifying the DOM:

  - Wait for `DOMContentLoaded` before modifying the DOM or calling `MutationObserver.observe`.

    ```js
    function boot() {
      const el = document.getElementById('my-element');
      el.textContent = 'Hello!';

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            console.log('Children changed:', mutation.addedNodes);
          }
        }
      });

      observer.observe(el, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
    ```

  - Remember the application will continue to render after your script loads. Do not assume the DOM
    is stable after `DOMContentLoaded`. You may use a `MutationObserver` to re-inject DOM
    modifications if the application removes or replaces them on re-render.

  - Never use a boolean flag (e.g., `var injected = false`) to guard against duplicate injection.
    React's Suspense boundaries, concurrent mode, and hot-module replacement can destroy and
    recreate entire subtrees, wiping out your injected elements while the flag still reads `true`.
    Instead, check whether the injected element still exists in the DOM:

    ```js
    var observer = new MutationObserver(function () {
      // Guard: skip if our elements are already in the DOM
      if (document.getElementById("my-injected-controls")) return;

      // ... find the target container and inject ...
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ```

  - Before making DOM modificationsj, double-check that the change will actually be visible. For
    example, many applications use `overflow: hidden` on flex containers to delegate scrolling to
    child elements. If you insert a new element into one of the se containers it will be clipped.

  - You must preseve the design system of the application. Try to re-use existing CSS classes when
    possible to ensure the design system of the content script you are generated matches that of
    the application.

  - When using `querySelector`, use the most specific selector possible to avoid matching unintended
    elements.

  - Never assume that React component props (e.g., `value`, `name`) are rendered as HTML attributes
    on the DOM element. Most UI libraries (Radix UI, MUI, Chakra, etc.) do not forward props
    directly to the DOM. For example, Radix UI's `<Tabs.Content value="foo">` does **not** produce
    `<div value="foo">` — it renders as `<div data-state="active" data-orientation="horizontal">`.
    Always verify the actual DOM attributes by reading the library's source or inspecting the
    rendered HTML, and use selectors that match the real DOM output (e.g., `data-state`, `role`,
    `aria-*`, class names) rather than guessing from the React JSX.

  - Never try to access or manipulate framework-managed component state from outside the framework.
    This includes reaching into React fiber internals (`__reactFiber$`, `__reactInternalInstance$`,
    `stateNode`, `memoizedProps`), calling component-library APIs (e.g., AG Grid's `gridApi`,
    DataGrid methods), or mutating props/state on framework-owned instances. These internals are
    version-specific, undocumented, and break silently. Instead, inject your own DOM elements
    alongside the application's UI — add new containers, overlay panels, or replace sections of the
    page with your own markup that you fully control.
