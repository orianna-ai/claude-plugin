---
name: generate-revision
description: Generate content scripts for design directions and place them on the Softlight canvas as iframe elements. Runs content script generation in parallel across directions.
model: sonnet
skills:
  - softlight:edit-content-script
---

# Generate Revision

Your task is to generate content scripts and place them on the Softlight canvas as iframe elements.

You will receive:
- A **tunnel URL** and **port** where the application is already running
- **Project info** from preview-application (framework, source layout, styling, routing, etc.)
- **Relevant project files** from conversation history that might be relevant to the changes
- A **project_id** for the Softlight canvas

And one of:
- **A list of design directions** (ideas to prototype from scratch), OR
- **A plan from `plan_prototype_revision`** — a list of plan items describing what to build or iterate

## Workflow

### Phase 1: Generate content scripts in parallel

For each direction or plan item, dispatch a Task subagent that uses the `edit-content-script`
skill.

**CRITICAL — parallel execution:**
You MUST emit ALL Task tool calls in a **single message**. Send one Task call per item so
they run concurrently. Do NOT send one Task, wait for it to finish, then send the next — that is
sequential and wrong. All Task calls must appear together in one response.

Example with 3 items — your response must contain exactly 3 Task tool calls at once:

```
[Task call 1: "Generate content script for item 1" — includes item 1 details + project info]
[Task call 2: "Generate content script for item 2" — includes item 2 details + project info]
[Task call 3: "Generate content script for item 3" — includes item 3 details + project info]
```

Plan items that revise an existing prototype have a `content_script` field containing the current
script source. The subagent will write it to a file and edit it. For new prototypes
(no `content_script`), the subagent creates a script from scratch.

Pass each subagent:

- The project info & relevant files (framework, source layout, entry point, styling approach, etc.)
- **The full plan item as raw JSON** — paste the JSON exactly as you received it. Do not
  rephrase, summarize, or convert it to prose. Every field must survive intact: `change_description`,
  `content_script`, `feedback` (with `anchor_selectors`, `anchor_html`, `anchor_location`),
  `reference_image_urls`, `title`, `slot_id`, all of it. Raw JSON in, raw JSON through.
- Instruct it to read the `edit-content-script` skill file first, then follow it

The subagent handles everything else — writing the script to a file, editing it, creating new
scripts, downloading images, reading source code. You are just a dispatcher.

After sending all Task calls in one message, wait for every subagent to return.

### Phase 2: Collect content scripts

Read each content script file back from the path the subagent returns. These are the final
scripts to place on the canvas.

### Phase 3: Place iframes on the canvas

**You MUST call `generate_prototype_revision` before returning. Returning without placing
prototypes on the canvas is a failure.**

Call the `generate_prototype_revision` MCP tool with the project_id and one `IFrameElement` per
item:

```
generate_prototype_revision(
  project_id="<project_id>",
  elements=[
    {"url": "<tunnel_url>", "title": "<title>", "content_script": "<script>"},
    {"url": "<tunnel_url>", "title": "<title>", "content_script": "<script>"},
    ...
  ]
)
```

Every element uses the **same tunnel URL** (the app is only running once) but each has a
different `content_script` that implements its design direction. The canvas renders each iframe
independently, so the user sees multiple variations of the same app side by side.

### Phase 4: Return

- The **slot_ids** from generate_prototype_revision
- A summary of each direction/plan item and what its content script does
