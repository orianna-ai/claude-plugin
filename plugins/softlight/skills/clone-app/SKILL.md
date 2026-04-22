---
name: clone-app
description: Clone an existing application to use as the basis for future design work.
---

# 1. Find the source code

Determine the `<source_dir>` in which the application source code is located.

# 2. Setup the clone

Run `./create_clone.py --source-dir <source_dir>` from this skill's directory. It will scaffold a
Vite + React + TypeScript project in a temporary directory, copy all code from `<source_dir>`,
install dependencies and print the absolute path to this directory to stdout. Capture the path as
`<clone_dir>`. Only read files in `<clone_dir>` - it has everything you need.

# 3. Fix the clone

Modify the cloned application so that:

- It has a functional entrypoint in `main.tsx`.
- All backend requests are replaced with hard-coded mock data using fetch interception.
- All authentication is removed. Assume the user is logged in with a mocked identity.

# 4. Make the build pass

Keep running `cd <clone_dir> && pnpm build` and fixing errors in `<clone_dir>` until it passes.

# 5. Run the application

Run `cd <clone_dir> && pnpm build && pnpm preview --host` to run the application. Then, pass the
port number the application is listening on to the `start-tunnel` skill and capture the resulting
`tunnel_id` that the application is accessible at.
