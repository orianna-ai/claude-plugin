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

- You must mock all backend requests. When mocking `fetch`:

  - You must handle `input instanceof Request`.

  - Mock every endpoint that the content script or application requires to demonstrate the `<spec>`.

  - Mock data must be statically defined.

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

  - Wait for `DOMContentLoaded` before modifying the DOM.

    ```js
    function boot() {
      const el = document.getElementById('my-element');
      el.textContent = 'Hello!';
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
    ```

  - The application will continue to render after your script loads, but do not use
    `MutationObserver` to re-inject DOM modifications on re-render. Inject a `<style>` that triggers
    `animationstart` on matching elements instead. This pattern works better with frameworks like
    React that assume they have full control over the DOM. Never include transient state in the
    observe selector. Observe stable structural elements and check transient state inside the
    listener.

    ```js
    function observe(selector, listener, signal) {
      const seenClass = 'sl-seen-' + btoa(selector).slice(0, 8);
      const animName = 'sl-observer-' + seenClass;

      const style = document.createElement('style');
      style.textContent = `
        @keyframes ${animName} { from { opacity: 1; } to { opacity: 1; } }
        :where(${selector}):not(.${seenClass}) {
          animation: 1ms ${animName};
        }
      `;
      document.body.prepend(style);
      signal.addEventListener('abort', () => style.remove());

      window.addEventListener('animationstart', (event) => {
        const target = event.target;
        if (target.classList.contains(seenClass) || !target.matches(selector)) return;
        target.classList.add(seenClass);
        listener(target);
      }, { signal });
    }

    const controller = new AbortController();
    observe('.my-button', (el) => { el.style.backgroundColor = 'red'; }, controller.signal);
    window.addEventListener('unload', () => controller.abort());
    ```

  - Before making DOM modificationsj, double-check that the change will actually be visible. For
    example, many applications use `overflow: hidden` on flex containers to delegate scrolling to
    child elements. If you insert a new element into one of the se containers it will be clipped.

  - You must preseve the design system of the application. Try to re-use existing CSS classes when
    possible to ensure the design system of the content script you are generated matches that of
    the application.

  - When using `querySelector`, use the most specific selector possible to avoid matching unintended
    elements.
