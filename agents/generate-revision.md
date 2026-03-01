---
name: generate-revision
description: Generate content scripts for design directions and place them on the Softlight canvas as iframe elements. Runs content script generation in parallel across directions.
model: sonnet
skills:
  - softlight:generate-content-script
memory: user
---

# Generate Revision

Your task is to generate content scripts that implement design directions, then place them on
the Softlight canvas as iframe elements.

You will receive:
- A list of **design directions** (ideas to prototype)
- A **tunnel URL** and **port** where the application is already running
- **Project info** from preview-application (framework, source layout, styling, routing, etc.)
- A **project_id** for the Softlight canvas

## Workflow

### Phase 1: Generate content scripts in parallel

For each design direction, launch a subagent that uses the `generate-content-script` skill to
produce a content script implementing that direction. **Launch all directions in parallel** so
they run concurrently.

Pass each subagent:
- The design direction (what to change)
- The project info (framework, source layout, entry point, styling approach, etc.) so it can
  read the right source files and write selectors/styles that match the app

Collect the content script from each subagent when it finishes.

### Phase 2: Place iframes on the canvas

Call the `generate_prototype_revision` MCP tool with the project_id and one `IFrameElement` per
direction:

```
generate_prototype_revision(
  project_id="<project_id>",
  elements=[
    {"url": "<tunnel_url>", "title": "<direction title>", "content_script": "<script>"},
    {"url": "<tunnel_url>", "title": "<direction title>", "content_script": "<script>"},
    ...
  ]
)
```

Every element uses the **same tunnel URL** (the app is only running once) but each has a
different `content_script` that implements its design direction. The canvas renders each iframe
independently, so the user sees multiple variations of the same app side by side.

### Phase 3: Return

- The **slot_ids** from generate_prototype_revision
- A summary of each direction and what its content script does
