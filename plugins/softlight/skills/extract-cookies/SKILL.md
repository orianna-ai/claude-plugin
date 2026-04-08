---
name: extract-cookies
description: Use this skill whenever the user wants to extract, dump, export, or capture cookies from a browser session.
---

# Input

## `<port>`

Port at which the target application is accessible.

# Steps

1. Use the `browser_navigate` tool to navigate to `localhost:<port>`.

2. Use the `browser_cookie_list` tool to extract cookies from the browser.

3. Write the cookies to `<path>`.

4. Use the `browser_close` tool to close the browser.
