---
name: run-orchestrator
description: Setup a Softlight project, generate initial prototypes, then refine them through two-pass evaluation and iteration.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__create_comment_thread, mcp__plugin_softlight_softlight__create_placeholder_slots, mcp__plugin_softlight_softlight__dispatch_prototype
model: sonnet
---

# Run Orchestrator

Orchestrate a fully autonomous Softlight design session. This is a **linear pipeline**, not a
loop. You run each phase exactly once, in order:

1. **Setup** — start the app, create a tunnel, explore the codebase, generate problem statement + design ideas
2. **Project Creation** — create the Softlight project
3. **Generate Initial Prototypes** — dispatch content script agents for each design idea
4. **Screenshot Initial Prototypes**
5. **Evaluate** — review prototypes and brainstorm next iteration directions
6. **Iterate** — dispatch content scripts for evaluator's solution directions, screenshot, pick winners
7. **Visual Refinement** — critique, generate visual variants, pick winners
8. **Summary**
9. **Cleanup** — stop background processes

All design work is delegated to skills running as background subagents — never do it inline.
Do not stop or ask the user clarifying questions for any reason.

## Phase 1: Setup

If a user has not input a design problem yet, ask them what design challenge they want to work on.

### 1a. Start the app (parallel)

Run these two as **background** subagents **in parallel**:

- **Content Script** — Run the `generate-content-script` skill to get the app into the right state
  for screenshotting. Pass it the user's input so it knows which app to target.
- **Application and Tunnel** — Run the `start-environment` skill. Pass it the user's input so it
  knows which app to start.

Wait for both to complete before proceeding to 1b.

### 1b. Explore and Ideate

Now that the app is running, take a screenshot of it via the tunnel URL so the agent can see
what the product looks like:

```
http://localhost:8080/api/tunnel/{tunnel_id}/?content_script_url={content_script_url}
```

Run the `explore-and-ideate` skill in a **background** subagent. Pass it:

- The user's input so it knows the design challenge
- The screenshot of the running app so it can see the product before proposing ideas

This agent explores the codebase and produces both the problem statement and 4-6 initial design
ideas. It writes its output to `/tmp/explore_and_ideate.json`.

Share the problem statement with the user when it is ready.

## Phase 2: Project Creation

Call the `create_project` tool with the problem statement, content script, and tunnel URL from
Phase 1. Share the `project_url` with the user (e.g., `[View in Softlight →](<project_url>)`) and
remember the `project_id` for future interactions.

## Phase 3: Generate Initial Prototypes

The design ideas come from the `explore-and-ideate` agent in Phase 1. This phase turns them into
content scripts on the canvas.

### 3a. Create slots and dispatch

Read the designs from `/tmp/explore_and_ideate.json`. Call `create_placeholder_slots` with
`project_id` and `num_slots` equal to the number of designs. Assign the returned slot IDs to
designs in order.

Format the plan as JSON and write it to `/tmp/plan_initial.json`:

```json
{
  "designs": [
    {
      "slot_id": "<assigned slot_id>",
      "spec": "<idea from explore-and-ideate>",
      "images": [],
      "caption": ""
    }
  ],
  "unused_slot_ids": []
}
```

Upload to drive and call `dispatch_prototype`:

```bash
curl -sF 'file=@/tmp/plan_initial.json;type=application/json' \
  https://drive.orianna.ai/api/v2/upload
```

Call `dispatch_prototype` with `project_id` and `plan_url` (the drive URL from the upload). This
creates `prompt_created` events for each design.

### 3b. Extract per-item prompts

Read the per-item prompts from the event history:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}/events" | python3 -c "
import json, sys
events = json.load(sys.stdin)
for event in events:
    if event.get('type') == 'prompt_created':
        prompt = event.get('prompt', {})
        key = prompt.get('key', '')
        if key.startswith('slot:'):
            pid = prompt.get('metadata', {}).get('id', '')
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"
```

Only process `slot:*` prompts that have **not** already been completed (check the event history
for a matching `prompt_completed` event).

### 3c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent with `model: "opus"`.

**CRITICAL: You MUST pass the prompt text from each event VERBATIM to the subagent — every
character. Do not summarize, shorten, paraphrase, or omit any part of it.
The prompt text is already self-contained — it includes the skill name, project ID, slot ID,
spec URL, image list, and content script URL. Just pass it through.**

For each subagent, pass it:

1. The full prompt text VERBATIM (it already contains everything the coding agent needs)
2. Instructions to mark the prompt as done when finished:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

### 3d. Wait for completion

Wait for **all** background subagents from step 3c to complete before proceeding. Do not move to
Phase 4 until every prototype has been generated.

## Phase 4: Screenshot Initial Prototypes

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

## Phase 5: Evaluate Prototypes

Dispatch the `evaluate` skill as a **background** subagent:

```
Read the `evaluate` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the evaluate subagent to complete. It does two things:

1. Posts feedback as comment threads on the canvas
2. Writes 4-6 solution directions for the next iteration to `/tmp/evaluate.json`

## Phase 6: Iterate

The evaluator's solution directions drive this phase. This is the same dispatch pattern as
Phase 3 — create slots, format plan, dispatch content scripts — just with specs from the
evaluator instead of from explore-and-ideate.

### 6a. Create slots and dispatch

Read the designs from `/tmp/evaluate.json`. Call `create_placeholder_slots` with `project_id`
and `num_slots` equal to the number of designs. Assign the returned slot IDs to designs in order.

Format the plan as JSON and write it to `/tmp/plan_iteration.json`:

```json
{
  "designs": [
    {
      "slot_id": "<assigned slot_id>",
      "spec": "<idea from evaluate.json>",
      "images": [],
      "caption": ""
    }
  ],
  "unused_slot_ids": []
}
```

Upload to drive and call `dispatch_prototype`:

```bash
curl -sF 'file=@/tmp/plan_iteration.json;type=application/json' \
  https://drive.orianna.ai/api/v2/upload
```

Call `dispatch_prototype` with `project_id` and `plan_url` (the drive URL from the upload).

### 6b. Extract per-item prompts

Read the per-item prompts from the event history:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}/events" | python3 -c "
import json, sys
events = json.load(sys.stdin)
for event in events:
    if event.get('type') == 'prompt_created':
        prompt = event.get('prompt', {})
        key = prompt.get('key', '')
        if key.startswith('slot:'):
            pid = prompt.get('metadata', {}).get('id', '')
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"
```

Only process `slot:*` prompts that have **not** already been completed (check the event history
for a matching `prompt_completed` event).

### 6c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent with `model: "opus"`.

**CRITICAL: You MUST pass the prompt text from each event VERBATIM to the subagent — every
character. Do not summarize, shorten, paraphrase, or omit any part of it.
The prompt text is already self-contained — it includes the skill name, project ID, slot ID,
spec URL, image list, and content script URL. Just pass it through.**

For each subagent, pass it:

1. The full prompt text VERBATIM (it already contains everything the coding agent needs)
2. Instructions to mark the prompt as done when finished:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

### 6d. Wait for completion

Wait for **all** background subagents from step 6c to complete before proceeding.

### 6e. Screenshot iteration prototypes

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

### 6f. Pick winners and plan visual refinements

Call `get_project`. Find the slots matching the iteration slot IDs from step 6a. Each iframe
slot has a `preview` attachment with a `url` field. Collect all previews.

Also collect baseline screenshot URLs from `problem.attachments`.

Dispatch the `pick-and-plan` skill as a **background** subagent:

```
Read the `pick-and-plan` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
<baseline_images>BASELINE_URLS</baseline_images>
<feedback>
[The evaluator's feedback from Phase 5 — the comment threads and solution directions that
drove these iteration variants]
</feedback>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
slot_id=SLOT_ID_2 preview_url=PREVIEW_URL_2
...
</variant_previews>
```

Wait for the subagent to complete. It does two things:

1. Picks the top 3 idea winners
2. Proposes 4-6 visual refinement directions per winner

It writes its output to `/tmp/pick_and_plan.json`.

### 6g. Post winner comments

From `/tmp/pick_and_plan.json`, parse the winners.

Call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 winner's slot_id
- text: "Iteration Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Call `get_project` and collect each winner's IFrameElement details:
- slot_id, content_script.url, preview.url, spec_url

You now have 3 idea winners with their element details and visual refinement specs. These feed
into Phase 7.

## Phase 7: Visual Refinement

### 7a. Create slots and dispatch

Read the visual refinements from `/tmp/pick_and_plan.json`. For each winner, the JSON contains
4-6 visual refinement directions.

For each winner, call `create_placeholder_slots` with `project_id` and `num_slots` equal to the
number of visual refinements for that winner. Assign slot IDs to refinements.

Flatten all refinements across all winners into a single plan JSON. For each refinement, set
the `spec` to the visual refinement idea and include the winner's `content_script_url` so the
content script agent edits the existing script rather than starting from scratch.

Write the plan to `/tmp/plan_visual.json`:

```json
{
  "designs": [
    {
      "slot_id": "<assigned slot_id>",
      "spec": "<visual refinement idea from pick_and_plan.json>",
      "images": [],
      "caption": "",
      "content_script_url": "<winner's content_script.url>"
    }
  ],
  "unused_slot_ids": []
}
```

Upload to drive and call `dispatch_prototype`:

```bash
curl -sF 'file=@/tmp/plan_visual.json;type=application/json' \
  https://drive.orianna.ai/api/v2/upload
```

Call `dispatch_prototype` with `project_id` and `plan_url` (the drive URL from the upload).

### 7b. Extract per-item prompts

Read the per-item prompts from the event history:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}/events" | python3 -c "
import json, sys
events = json.load(sys.stdin)
for event in events:
    if event.get('type') == 'prompt_created':
        prompt = event.get('prompt', {})
        key = prompt.get('key', '')
        if key.startswith('slot:'):
            pid = prompt.get('metadata', {}).get('id', '')
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"
```

Only process `slot:*` prompts that have **not** already been completed (check the event history
for a matching `prompt_completed` event).

### 7c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent with `model: "opus"`.

**CRITICAL: You MUST pass the prompt text from each event VERBATIM to the subagent — every
character. Do not summarize, shorten, paraphrase, or omit any part of it.
The prompt text is already self-contained — it includes the skill name, project ID, slot ID,
spec URL, image list, and content script URL. Just pass it through.**

For each subagent, pass it:

1. The full prompt text VERBATIM (it already contains everything the coding agent needs)
2. Instructions to mark the prompt as done when finished:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

### 7d. Wait for completion

Wait for **all** background subagents from step 7c to complete before proceeding.

### 7e. Screenshot visual variants

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

### 7f. Pick visual winners

Call `get_project`. Collect all visual variant slot IDs and their preview URLs. Also collect
baseline screenshot URLs from `problem.attachments`.

Dispatch the `idea-pick` skill as a single **background** subagent:

```
Read the `idea-pick` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<original_prototype_images>BASELINE_URLS</original_prototype_images>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
...
</variant_previews>
<feedback>
These are visual refinements of the idea winners. Pick the top 3 that look most professionally
designed while still solving the design problem.
</feedback>
```

Wait for the pick subagent to complete.

### 7g. Post visual winner comments

From the pick subagent's output, parse the `WINNERS:` section — 3 slot_ids.

Call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 winner's slot_id
- text: "Visual Refinement Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

## Phase 8: Summary

Print a final summary:

```
Refinement complete.

Iteration: [N] solution directions → 3 idea winners
Visual Refinement: 3 winners × [N] variants → 3 visual winners

Idea winners: [slot_id_1, slot_id_2, slot_id_3]
Visual winners: [slot_id_1, slot_id_2, slot_id_3]
```

## Phase 9: Cleanup

Run the `stop-tunnel` skill and the `stop-application` skill to kill background processes.
