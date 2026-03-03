---
name: generate-revision
description: Generate content scripts for design directions and place them on the Softlight canvas as iframe elements. Runs content script generation in parallel across directions.
model: sonnet
skills:
  - softlight:generate-content-script
---

# Generate Revision

Your task is to generate content scripts that implement design directions, then place them on
the Softlight canvas as iframe elements.

You will receive:
- A list of **design directions** (ideas to prototype), including images of those directions
- A **tunnel URL** and **port** where the application is already running
- **Project info** from preview-application (framework, source layout, styling, routing, etc.)
- A **project_id** for the Softlight canvas

## Workflow

### Phase 1: Generate content scripts in parallel

For each design direction, dispatch a Task subagent that uses the `generate-content-script` skill.

**CRITICAL — parallel execution:**
You MUST emit ALL Task tool calls in a **single message**. Send one Task call per direction so
they run concurrently. Do NOT send one Task, wait for it to finish, then send the next — that is
sequential and wrong. All Task calls must appear together in one response.

Example with 3 directions — your response must contain exactly 3 Task tool calls at once:

```
[Task call 1: "Generate content script for direction 1" — includes direction 1 details + project info]
[Task call 2: "Generate content script for direction 2" — includes direction 2 details + project info]
[Task call 3: "Generate content script for direction 3" — includes direction 3 details + project info]
```

Pass each subagent:
- The design direction (what to change)
- The project info (framework, source layout, entry point, styling approach, etc.) so it can
  read the right source files and write selectors/styles that match the app
- **Reference images from the problem.** The user's problem includes screenshots of the current
  experience. Pass these image URLs to each subagent so it can see what the app actually looks
  like and produce output that closely matches the visual style, layout, density, and content
  of those screenshots. This is critical — without the images the content script will generate
  generic UI that looks nothing like the real app.
- **THE DESIGN DIRECTION IMAGE.** Each direction includes a mockup image showing EXACTLY what
  to build. Pass this image URL to the subagent and tell it explicitly: "This image is the
  design direction. Your content script MUST implement what you see in this image. Treat this
  image as the specification — match its layout, components, content, and visual details as
  closely as possible."
- Instruct it to read the `generate-content-script` skill file first, then follow it

**⚠️ CRITICAL: THE DESIGN DIRECTION IMAGE IS THE SPECIFICATION ⚠️**

Each design direction includes a mockup image. This image is NOT just a reference — it IS the
design. The content script must implement exactly what that image shows. If the image shows a
sidebar with 5 nav items, the content script creates a sidebar with 5 nav items. If the image
shows a card grid with specific content, the content script creates that card grid with that
content. The subagent must study the design direction image and reproduce it faithfully.

After sending all Task calls in one message, wait for every subagent to return, then collect
each content script.

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
