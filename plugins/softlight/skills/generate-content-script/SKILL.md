---
name: generate-content-script
description: >
  Generate a content script - a self-contained JavaScript file that is injected into a running
  application in order to preview a change to an application without having to modify and rebuild
  the application itself.
---

# Input

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

- When mocking `fetch`:

  - You must handle `input instanceof Request`.

  - Mock every endpoint that the content script or application requires to demonstrate the `<spec>`.

  - Mock data must be statically defined. Never use `fetch` to generate mock data.

  - You should always provide realistic mock data. Include enough data to demonstrate the `<spec>`.

  - Check how the application constructs the `input` argument. Applications that are built with
    Vite, for example, will prepend `VITE_API_URL` to the `input`.

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

  - Before making DOM modificationsj, double-check that the change will actually be visible. For
    example, many applications use `overflow: hidden` on flex containers to delegate scrolling to
    child elements. If you insert a new element into one of the se containers it will be clipped.

  - You must preseve the design system of the application. Try to re-use existing CSS classes when
    possible to ensure the design system of the content script you are generated matches that of
    the application.

  - When using `querySelector`, use the most specific selector possible to avoid matching unintended
    elements.
