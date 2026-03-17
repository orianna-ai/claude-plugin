---
name: generate-pull-request
description: >
  Take a Softlight prototype's content script and implement its changes into the source code,
  then create a GitHub pull request. Use when the user wants to ship a design prototype as a
  real code change.
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Generate PR

Take a Softlight prototype and turn it into a real code change. Softlight prototypes use a
content script — a JavaScript snippet injected at runtime — to preview changes on top of the
running application. Your job is to understand what the content script does and properly
implement those changes in the source code, then open a pull request.

## Required inputs

This skill **must** be called with the following context. Do not proceed without all of them:

- `content_script` — the JavaScript content script from the prototype
- `project_id` — the Softlight project ID
- `slot_id` — the slot ID of the prototype iframe
- `tunnel-url` — the URL where the application is running

These are provided in the prompt inside a `<prototype>` tag. Parse them from there.

## Workflow

### Step 1: Understand the content script

Read the `content_script` carefully. It is a JavaScript IIFE that overlays changes on the
running application — it may inject `<style>` tags, mutate the DOM, add new components or
pages, change layout and styling, or mock data to simulate new backend functionality.

Understand **all** the changes it makes:
- **Styling** — CSS overrides, new styles, layout changes, colors, typography, spacing
- **Components** — new UI elements, restructured markup, modified component behavior
- **Functionality** — new interactions, navigation changes, mock data that represents
  intended backend features

Determine how each of these should be expressed as proper, permanent changes in the source code.

### Step 2: Implement the changes

Find the relevant source files and implement the content script's changes properly in the
codebase. This is not a copy-paste of the content script — translate the prototype's intent
into clean, production-ready code. You must fully implement the feature, not leave TODOs or
placeholders.

### Step 3: Create the pull request

1. **Create a new branch off of `main`** — fetch the latest `main` and branch from it.
   Do not branch from the current working branch.
2. **Commit the changes** with a descriptive message followed by "Designed with Softlight".
   Add `Co-authored-by: Softlight <hello@softlight.com>` as a commit trailer.
   Do NOT add yourself (Claude) as a co-author — the only co-author should be Softlight.
3. **Push the branch** to the remote.
4. **Try to open a pull request** against `main` (e.g. via `gh pr create`). If this fails
   for any reason (missing CLI, auth issues, etc.), that's fine — construct the GitHub
   compare URL instead: `https://github.com/<owner>/<repo>/compare/main...<branch>`.
   The user can open the PR from there.
5. **Record the result** by posting a `pull_request_created` event. Substitute the actual
   values for `<project_id>`, `<github_url>`, `<slot_id>`, and `<git_branch>`:
   ```
   curl -s -X POST "https://softlight.orianna.ai/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"pull_request_created","github_url":"<github_url>","slot_id":"<slot_id>","git_branch":"<git_branch>"}]'
   ```
   This posts the URL back to the Softlight canvas so the user can see it.

### Step 4: Return

Tell the user what happened — whether the PR was created or the branch was pushed — and
share the URL.
