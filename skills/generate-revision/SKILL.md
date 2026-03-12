---
name: generate-revision
description: >
  Generate content scripts for design directions and place them on the Softlight canvas as iframe
  elements. Runs content script generation in parallel across directions.
---

# Generate Revision

Generate content scripts and place them on the Softlight canvas as iframe elements.

You will receive:

- A **tunnel URL** and **port** where the application is already running
- An **application analysis** from `code-analysis`
- A **project_id** for the Softlight canvas

And one of:

- A list of **design directions** OR
- A **plan** from `plan_prototype_revision` — a list of plan items describing what to build or
  iterate

## Phase 1: Generate content scripts in parallel

For each direction or plan item, dispatch a Task subagent that uses `generate-content-script`.

**All Task calls MUST be in a single message.** Do not send them sequentially.

Pass each subagent:

- The application analysis
- All relevant image URLs (problem screenshots + direction-specific mocks)
- Instruction to read the `generate-content-script` skill file first, then follow it

**If you received plan items:** pass the full plan item as raw JSON — paste the JSON exactly as you
received it. Do not rephrase, summarize, or convert it to prose. Every field must survive intact:
`change_description`, `content_script`, `feedback` (with `anchor_selectors`, `anchor_html`,
`anchor_location`), `reference_image_urls`, `title`, `slot_id`, all of it. Raw JSON in, raw JSON
through. The subagent handles everything else — writing the script to a file, editing it, creating
new scripts, downloading images, reading source code. You are just a dispatcher.

**If you received design directions:** pass the design direction description and any associated
image URLs.

Wait for all subagents to return.

## Phase 2: Collect content scripts

Read each content script file back from the path the subagent returns.

## Phase 3: Place iframes on the canvas

You MUST call `generate_prototype_revision` before returning. Returning without placing prototypes
on the canvas is a failure.

```
generate_prototype_revision(
  project_id="<project_id>",
  elements=[
    {"url": "<tunnel_url>", "title": "<direction title>", "content_script": "<script>"},
    ...
  ]
)
```

Every element uses the same tunnel URL (the app is only running once) but each has a different
`content_script`.

## Phase 4: Return

Return the `slot_ids` and a summary of each direction.
