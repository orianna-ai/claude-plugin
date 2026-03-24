---
name: run-orchestrator
description: Setup a Softlight project, generate initial prototypes, then refine them through two-pass evaluation and iteration.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__create_comment_thread, mcp__plugin_softlight_softlight__create_placeholder_slots
model: sonnet
---

# Run Orchestrator

Orchestrate a fully autonomous Softlight design session. This is a **linear pipeline**, not a
loop. You run each phase exactly once, in order:

1. **Setup** — start the app, create a tunnel, generate a problem statement
2. **Project Creation** — create the Softlight project
3. **Generate Initial Prototypes** — use `plan-new-ideas` to generate the first set of designs
4. **Screenshot Initial Prototypes**
5. **Evaluate** — PM and designer review
6. **Extract Feedback** — build labeled feedback per prototype
7. **Idea Refinement** — generate idea variants, pick winners
8. **Visual Refinement** — critique, generate visual variants, pick winners
9. **Summary**
10. **Cleanup** — stop background processes

All design work is delegated to skills running as background subagents — never do it inline.
Do not stop or ask the user clarifying questions for any reason.

## Phase 1: Setup

If a user has not input a design problem yet, ask them what design challenge they want to work on.

Use the agent tool to run the setup steps as **background** subagents **in parallel**.

### 1a. Content Script

Run the `generate-content-script` skill in a **background** subagent to get the app into the right
state for screenshotting. Pass it the user's input so it knows which app to target.

### 1b. Application and Tunnel

Run the `start-environment` skill in a **background** subagent. Pass it the user's input so it
knows which app to start.

### 1c. Problem Statement

Run the `generate-problem-statement` skill in a **background** subagent.

Share the problem statement with the user when it is ready.

Phase 1a - 1c subagents must all complete before going to phase 2.

## Phase 2: Project Creation

Call the `create_project` tool with the problem statement, content script, and tunnel URL from
Phase 1. Share the `project_url` with the user (e.g., `[View in Softlight →](<project_url>)`) and
remember the `project_id` for future interactions.

## Phase 3: Generate Initial Prototypes

This phase runs **once** to generate the first set of prototypes. Do not repeat it.

### 3a. Plan and dispatch

Call `plan_prototype_revision` directly with the `project_id`. It creates placeholder slots and
returns `new_ideas_prompt` + `new_ideas_slot_ids`. Ignore any other fields in the response.

Dispatch the `new_ideas_prompt` as a **background** subagent:

```
description: "New ideas planner"
model: "sonnet"
run_in_background: true
prompt: <the full new_ideas_prompt text, plus the additions below>
```

Append the following context after the prompt text:

- Remind the subagent to use `http://localhost:8080` as the API host for all `curl` commands
  (the same host as the Softlight MCP server, not a hard-coded production URL).

**Wait** for the planner subagent to finish before proceeding to 3b.

The planner handles dispatching via the `dispatch_prototype` MCP tool — it writes a plan JSON to
a file, uploads it to drive, then calls `dispatch_prototype` with the `project_id` and `plan_url`,
which creates `prompt_created` events for each design.

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

This gives you the prompt text and prompt_id for each per-item prompt. Only process `slot:*`
prompts that have **not** already been completed (check the event history for a matching
`prompt_completed` event).

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

## Phase 5: Evaluate Prototypes (PM first, then Designer)

### 5a. PM Review

Dispatch the `evaluate-prototypes` skill as a **background** subagent:

```
Read the `evaluate-prototypes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the PM subagent to complete.

### 5b. Snapshot PM Comments

Call `get_project`. Find all `CommentThreadElement` slots across all revisions. Record their
slot metadata IDs — these are the PM's comment threads.

### 5c. Designer Review

Dispatch the `evaluate-prototypes-designer` skill as a **background** subagent:

```
Read the `evaluate-prototypes-designer` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the designer subagent to complete.

## Phase 6: Extract Labeled Feedback Per Prototype

Call `get_project`. Find all `CommentThreadElement` slots across all revisions. For each one:

1. Check if its slot metadata ID was in the PM snapshot from 5b.
   - If yes → PM comment
   - If no → Designer comment
2. Check its `references` list for `SlotReference` entries. The `slot_id` in the reference
   identifies which prototype this feedback is about.
3. Extract the comment text from `element.comments[].text`.

Build a feedback block for each prototype:

```
**PM Feedback:**
[all PM comment texts that reference this prototype's slot_id, separated by newlines]

**Product Designer Feedback:**
[all designer comment texts that reference this prototype's slot_id, separated by newlines]
```

Comments with no slot reference (cross-cutting feedback) should be included in every prototype's
feedback block, labeled appropriately.

Also extract from `get_project` for each prototype in revision 1:
- `slot_id`
- `element.content_script.url`
- `element.spec_url`
- `element.preview.url` (if exists)
- `element.screenshots` list
- Baseline screenshot URLs from `problem.attachments`

## Phase 7: Idea Refinement

All prototypes are processed **in parallel** within each sub-step.

### 7a. Create Placeholder Slots

For each prototype, call `create_placeholder_slots` with `project_id` and `num_slots=6`. This
creates a new revision with 6 placeholder slots in the next available row and returns their IDs.

Track which slot IDs belong to which prototype.

### 7b. Dispatch Idea Variant Planners (all in parallel)

For each prototype, dispatch the `idea-variant-plan` skill as a **background** subagent:

```
Read the `idea-variant-plan` skill and follow its instructions.

Reminder: use http://localhost:8080 as the API host for all curl commands.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<feedback>
[labeled feedback block for this prototype from Phase 6]
</feedback>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>PROTOTYPE_PREVIEW_AND_SCREENSHOT_URLS</prototype_images>
<prototype_spec_url>SPEC_URL</prototype_spec_url>
<slot_ids>
SLOT_ID_1
SLOT_ID_2
...
SLOT_ID_6
</slot_ids>
<content_script_url>CONTENT_SCRIPT_URL</content_script_url>
<project_id>PROJECT_ID</project_id>
```

Dispatch ALL planners in parallel, then wait for ALL to complete.

### 7c. Extract Prompts and Dispatch Content Scripts (all in parallel)

Collect ALL idea variant slot IDs across all prototypes into one set. Extract uncompleted
prompts matching those slot IDs:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}/events" | python3 -c "
import json, sys

my_slot_ids = set([...ALL idea variant slot IDs...])

events = json.load(sys.stdin)
completed_ids = set()
for event in events:
    if event.get('type') == 'prompt_completed':
        completed_ids.add(event.get('prompt_id'))
for event in events:
    if event.get('type') == 'prompt_created':
        prompt = event.get('prompt', {})
        key = prompt.get('key', '')
        pid = prompt.get('metadata', {}).get('id', '')
        slot_id = key.replace('slot:', '') if key.startswith('slot:') else ''
        if slot_id in my_slot_ids and pid not in completed_ids:
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"
```

For each uncompleted prompt, dispatch a **background** subagent with `model: "opus"`.

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

Dispatch ALL content script subagents in parallel, then wait for ALL to complete.

### 7d. Screenshot Idea Variants

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

### 7e. Collect Previews and Dispatch Idea Picks (all in parallel)

Call `get_project`. For each prototype, find the slots matching that prototype's idea variant
slot IDs. Each iframe slot has a `preview` attachment with a `url` field. Build a preview list
per prototype.

For each prototype, dispatch the `idea-pick` skill as a **background** subagent:

```
Read the `idea-pick` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<original_prototype_images>THIS_PROTOTYPE_PREVIEW_URL</original_prototype_images>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
slot_id=SLOT_ID_2 preview_url=PREVIEW_URL_2
...
</variant_previews>
<feedback>
[labeled feedback block for this prototype]
</feedback>
```

Dispatch ALL pick subagents in parallel, then wait for ALL to complete.

### 7f. Parse Winners and Post Comments

From each idea-pick subagent's output, parse the `WINNERS:` section — 3 slot_ids per prototype.

For each prototype, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 winner's slot_id
- text: "Pass 1 (Idea Refinement) Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Call `get_project` and collect each winner's IFrameElement details:
- slot_id, content_script.url, preview.url, spec_url

You now have idea winners (3 per prototype) with their element details. These feed into Phase 8.

## Phase 8: Visual Refinement

All idea winners are processed **in parallel** within each sub-step.

### 8a. Dispatch Visual Critiques (all in parallel)

For each idea winner, dispatch the `visual-critique` skill as a **background** subagent:

```
Read the `visual-critique` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>WINNER_PREVIEW_URL</prototype_images>
<prototype_spec_url>WINNER_SPEC_URL</prototype_spec_url>
```

Dispatch ALL critique subagents in parallel, then wait for ALL to complete.

### 8b. Parse Critiques and Post Comments

From each critique subagent's output, parse the `PROBLEMS:` section — 3-5 problems per
winner. Store these for the variant planners.

For each winner, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: WINNER_SLOT_ID
- text: "Visual Critique:\n\n1. [problem 1]\n2. [problem 2]\n..."

### 8c. Create Placeholder Slots

For each idea winner, call `create_placeholder_slots` with `project_id` and `num_slots=6`. This
creates a new revision with 6 placeholder slots in the next available row and returns their IDs.

Track which slot IDs belong to which winner.

### 8d. Dispatch Visual Variant Planners (all in parallel)

For each idea winner, dispatch the `visual-variant-plan` skill as a **background** subagent:

```
Read the `visual-variant-plan` skill and follow its instructions.

Reminder: use http://localhost:8080 as the API host for all curl commands.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<problems>
1. [problem 1 from this winner's critique]
2. [problem 2 from this winner's critique]
...
</problems>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>WINNER_PREVIEW_URL</prototype_images>
<slot_ids>
SLOT_ID_1
...
SLOT_ID_6
</slot_ids>
<content_script_url>WINNER_CONTENT_SCRIPT_URL</content_script_url>
<project_id>PROJECT_ID</project_id>
```

Dispatch ALL planners in parallel, then wait for ALL to complete.

### 8e. Extract Prompts and Dispatch Content Scripts (all in parallel)

Collect ALL visual variant slot IDs across all winners into one set. Extract uncompleted
prompts matching those slot IDs:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}/events" | python3 -c "
import json, sys

my_slot_ids = set([...ALL visual variant slot IDs...])

events = json.load(sys.stdin)
completed_ids = set()
for event in events:
    if event.get('type') == 'prompt_completed':
        completed_ids.add(event.get('prompt_id'))
for event in events:
    if event.get('type') == 'prompt_created':
        prompt = event.get('prompt', {})
        key = prompt.get('key', '')
        pid = prompt.get('metadata', {}).get('id', '')
        slot_id = key.replace('slot:', '') if key.startswith('slot:') else ''
        if slot_id in my_slot_ids and pid not in completed_ids:
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"
```

For each uncompleted prompt, dispatch a **background** subagent with `model: "opus"`.

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

Dispatch ALL content script subagents in parallel, then wait for ALL to complete.

### 8f. Screenshot Visual Variants

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

### 8g. Collect Previews and Dispatch Visual Picks (all in parallel)

Call `get_project`. For each idea winner, find the slots matching that winner's visual variant
slot IDs. Build a preview list per winner.

For each winner, dispatch the `visual-pick` skill as a **background** subagent:

```
Read the `visual-pick` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<original_prototype_images>WINNER_PREVIEW_URL</original_prototype_images>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
...
</variant_previews>
<problems>
1. [problem 1 from this winner's critique]
...
</problems>
<round>1</round>
<is_last_round>true</is_last_round>
```

Dispatch ALL pick subagents in parallel, then wait for ALL to complete.

### 8h. Parse Winners and Post Comments

From each visual-pick subagent's output, parse the `WINNERS:` section — 3 slot_ids per idea
winner.

For each idea winner, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 visual winner's slot_id
- text: "Pass 2 (Visual Refinement) Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

## Phase 9: Summary

Print a final summary:

```
Refinement complete.

Pass 1 (Idea Refinement): [N] prototypes × ~5 variants → [3N] idea winners
Pass 2 (Visual Refinement): [3N] idea winners × ~5 variants → [9N] visual winners

Per prototype:
  Prototype [slot_id]:
    Idea winners: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #1: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #2: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #3: [slot_id_1, slot_id_2, slot_id_3]
  ...
```

## Phase 10: Cleanup

Run the `stop-tunnel` skill and the `stop-application` skill to kill background processes.
