---
name: generate-revision
description: >
  Generate content scripts for design directions and place them on the Softlight canvas as iframe
  elements. Runs content script generation in parallel across directions.
---

# Generate Revision

Generate content scripts for design directions and place them on the canvas as iframes.

You will receive:
- A list of **design directions**
- A **tunnel URL** and **port**
- An **application analysis** from `code-analysis`
- A **project_id**

## Phase 1: Generate content scripts in parallel

Dispatch one Task subagent per direction using `generate-content-script`.

**All Task calls MUST be in a single message.** Do not send them sequentially.

Pass each subagent:
- The design direction
- The application analysis
- All relevant image URLs (problem screenshots + direction-specific mocks)
- Instruction to read the `generate-content-script` skill file first, then follow it

Wait for all subagents, then collect the content scripts.

## Phase 2: Place iframes on the canvas

Call `generate_prototype_revision`:

```
generate_prototype_revision(
  project_id="<project_id>",
  elements=[
    {"url": "<tunnel_url>", "title": "<direction title>", "content_script": "<script>"},
    ...
  ]
)
```

All elements use the same tunnel URL. Each has a different content script.

## Phase 3: Return

Return the `slot_ids` and a summary of each direction.
