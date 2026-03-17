---
name: add-app
description: "Add an app to Softlight so it can start it quickly in future design sessions."
allowed-tools: Bash, Read, Write, Glob, Grep
model: sonnet
---

# Add App

The user wants to configure a web application so that Softlight can start it quickly in the future.
You will receive a description of which app to set up. Your job is to explore the codebase, figure
out how to run it, and save the instructions to `CLAUDE.md`.

## Step 1: Check for existing build instructions

Read the `CLAUDE.md` file at the project root and look for a **"Softlight Build Instructions"**
section. If it already contains a subsection that matches the app the user described, tell the user
that this app is already configured and show them the existing instructions. Do not explore the
codebase or modify the file — just stop here.

If the app is not already configured, proceed to Step 2.

## Step 2: Find the start command

Find the app that the user described. You may be operating in a monorepo, so find the right app.

Find the command used to run the dev server for the application. It's often mentioned in build
files (`package.json`, `Makefile`, `BUILD.bazel`, `pyproject.toml`, etc.) or in documentation.

Figure out:

- The exact command to start the dev server
- How the port is configured (environment variable, CLI flag, config file, etc.)
- Any prerequisites (install steps, environment variables, services that need to be running, etc.)
- Where the app's source code lives in the repo

## Step 3: Save build instructions to CLAUDE.md

Read the `CLAUDE.md` file at the project root. If it does not already have a
`## Softlight Build Instructions` section, create one at the end of the file.

Add a subsection for the app. If a subsection for this app already exists, replace it with the
updated instructions.

Write enough detail that a future agent can confidently determine whether this entry matches the
app it has been asked to start — even if the repo contains multiple similar apps. Include:

- A clear description of what the app is and what it serves (e.g. "the public-facing logged-out
  homepage" vs "the authenticated dashboard")
- The directory path where the app lives in the repo
- If there are other similar apps in the repo that could be confused with this one, explicitly call
  them out (e.g. "Not to be confused with `server/inspiration` which is the logged-in version")
- The exact start command
- How the port is configured (environment variable, CLI flag, etc.)
- Any prerequisites (install steps, environment variables, services that need to be running)
- How to verify the app is ready (health check endpoint and expected response)

Example format:

```markdown
## Softlight Build Instructions

### my-app

Public-facing marketing site. Located at `apps/web`. This is NOT the same as `apps/admin` which
is the internal admin dashboard.

To start: `PORT=$PORT npm run dev`

The server reads the `PORT` environment variable. No other setup is required.
Health check: `GET /` returns 200 when ready.
```

## Step 4: Confirm

Tell the user what you saved and which app was configured. Let them know that future Softlight runs
targeting this app will start faster.
