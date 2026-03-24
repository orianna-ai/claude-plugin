---
name: iterate
description: >
  Two-pass refinement loop for Softlight prototypes. Evaluates prototypes with PM and designer
  feedback, then runs batch-parallel idea refinement (4-6 variants → 3 winners per prototype)
  followed by batch-parallel visual polish (4-6 variants → 3 winners per idea winner).
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__dispatch_prototype, mcp__plugin_softlight_softlight__create_comment_thread, mcp__plugin_softlight_softlight__update_iframe_element
model: sonnet
---

# Run Two-Pass Refinement

Evaluate existing Softlight prototypes with PM and designer feedback, then refine them through
two batch-parallel passes: idea evolution and visual polish. All prototypes are processed in
parallel within each batch step, but the steps themselves run sequentially. Do not stop or ask
clarifying questions.

## Inputs

You will receive:

- **`<project_id>`** — Softlight project UUID
- **`<user_prompt>`** — *(optional)* The original prompt the user gave when starting the session.
  If not provided, use the problem statement from `get_project` as a fallback.

## Constants

```
IFRAME_WIDTH = 1720
IFRAME_HEIGHT = 1120
IFRAME_STRIDE = 1840
IFRAME_ROW_GAP = 1000
ROW_HEIGHT = 2120  # IFRAME_HEIGHT + IFRAME_ROW_GAP
NUM_VARIANTS = 6   # max placeholder slots per prototype; planners aim for 4-6
NUM_WINNERS = 3
ROWS_PER_PROTOTYPE = 4  # 1 idea row + 3 visual rows (one per idea winner)
API_HOST = http://localhost:8080
```

## Phase 1: Get Project State and Pre-Compute Layout

Call `get_project` with the `project_id`. From the response:

1. Extract the **problem statement** from `problem.text`.
2. Extract **baseline screenshots** from `problem.attachments` — save the URLs.
3. Find all iframe slots in **revision 1** (the first revision). These are the prototypes to
   refine. For each, note:
   - `slot_id`
   - `element.content_script.url`
   - `element.spec_url`
   - `element.preview.url` (if exists)
   - `element.screenshots` list

### Pre-compute row y-positions

Find the maximum bottom edge of all existing slots: `max(slot.y + slot.height)` across all
revisions. Call this `base_y_start`.

Each prototype owns a contiguous block of 4 rows:

```
base_y = base_y_start + IFRAME_ROW_GAP

For prototype index P (0-based):
  idea_row_y      = base_y + (P * 4 + 0) * ROW_HEIGHT
  visual_row_y[0] = base_y + (P * 4 + 1) * ROW_HEIGHT
  visual_row_y[1] = base_y + (P * 4 + 2) * ROW_HEIGHT
  visual_row_y[2] = base_y + (P * 4 + 3) * ROW_HEIGHT
```

## Phase 2: Screenshot Prototypes

Dispatch the `screenshot-iframes` skill as a **background** subagent:

```
Read the `screenshot-iframes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
```

Wait for the screenshot subagent to complete.

## Phase 3: Evaluate Prototypes (PM first, then Designer)

### 3a. PM Review

Dispatch the `evaluate-prototypes` skill as a **background** subagent:

```
Read the `evaluate-prototypes` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the PM subagent to complete.

### 3b. Snapshot PM Comments

Call `get_project`. Find all `CommentThreadElement` slots across all revisions. Record their
slot metadata IDs — these are the PM's comment threads.

### 3c. Designer Review

Dispatch the `evaluate-prototypes-designer` skill as a **background** subagent:

```
Read the `evaluate-prototypes-designer` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<problem_statement>PROBLEM_STATEMENT</problem_statement>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the designer subagent to complete.

## Phase 4: Extract Labeled Feedback Per Prototype

Call `get_project`. Find all `CommentThreadElement` slots across all revisions. For each one:

1. Check if its slot metadata ID was in the PM snapshot from 3b.
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

## Phase 5: Batch Idea Refinement

All prototypes are processed **in parallel** within each sub-step.

### 5a. Create Placeholder Slots

For each prototype P, create a new revision with NUM_VARIANTS placeholder slots at
`idea_row_y` for that prototype:

```bash
python3 -c "
import json, uuid, sys

num_variants = 6
base_y = $IDEA_ROW_Y  # substitute the computed y for this prototype
stride = 1840
slot_ids = [str(uuid.uuid4()) for _ in range(num_variants)]
events = [{'type': 'revision_created', 'revision': {}}]
for i, sid in enumerate(slot_ids):
    events.append({
        'type': 'slot_created',
        'slot': {
            'metadata': {'id': sid},
            'element': {'type': 'placeholder'},
            'width': 1720.0,
            'height': 1120.0,
            'x': float(i * stride),
            'y': base_y
        }
    })
print(json.dumps(events))
print(','.join(slot_ids), file=sys.stderr)
" 2>/tmp/idea_slots_P.txt | curl -s -X POST "API_HOST/api/projects/PROJECT_ID/events" \
    -H 'Content-Type: application/json' -d @-
```

Run this for each prototype (can be sequential — it's fast). Save the slot IDs from each
`/tmp/idea_slots_P.txt` file. Track which slot IDs belong to which prototype.

### 5b. Dispatch Idea Variant Planners (all in parallel)

For each prototype, dispatch the `idea-variant-plan` skill as a **background** subagent:

```
Read the `idea-variant-plan` skill and follow its instructions.

Reminder: use http://localhost:8080 as the API host for all curl commands.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<feedback>
[labeled feedback block for this prototype from Phase 4]
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

### 5c. Extract Prompts and Dispatch Content Scripts (all in parallel)

Collect ALL idea variant slot IDs across all prototypes into one set. Extract uncompleted
prompts matching those slot IDs:

```bash
curl -s "API_HOST/api/projects/PROJECT_ID/events" | python3 -c "
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

### 5d. Collect Previews and Dispatch Idea Picks (all in parallel)

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

### 5e. Parse Winners and Post Comments

From each idea-pick subagent's output, parse the `WINNERS:` section — 3 slot_ids per
prototype, 18 total.

For each prototype, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 winner's slot_id
- text: "Pass 1 (Idea Refinement) Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Call `get_project` and collect each winner's IFrameElement details:
- slot_id, content_script.url, preview.url, tunnel_id, git_commit, spec_url, git_patch

Create 3 winner iframe slots at x=NUM_VARIANTS, NUM_VARIANTS+1, NUM_VARIANTS+2 in each
prototype's idea row (so they appear to the right of the variants):

```bash
python3 -c "
import json, uuid

winners = [
    {'tunnel_id': 'TID', 'git_commit': 'COMMIT', 'content_script_url': 'URL',
     'spec_url': 'SPEC', 'preview_url': 'PREV', 'git_patch_url': 'PATCH_OR_NULL'},
    # winner 2, winner 3
]
base_y = IDEA_ROW_Y
stride = 1840
start_x = 6  # after the variant slots

events = []
for j, w in enumerate(winners):
    wsid = str(uuid.uuid4())
    element = {
        'type': 'iframe',
        'tunnel_id': w['tunnel_id'],
        'git_commit': w['git_commit'],
        'spec_url': w['spec_url'],
    }
    if w.get('content_script_url'):
        element['content_script'] = {'url': w['content_script_url']}
    if w.get('preview_url'):
        element['preview'] = {'url': w['preview_url']}
    if w.get('git_patch_url'):
        element['git_patch'] = {'url': w['git_patch_url']}
    events.append({
        'type': 'slot_created',
        'slot': {
            'metadata': {'id': wsid},
            'element': element,
            'width': 1720.0,
            'height': 1120.0,
            'x': float((start_x + j) * stride),
            'y': base_y
        }
    })
print(json.dumps(events))
" | curl -s -X POST "API_HOST/api/projects/PROJECT_ID/events" \
    -H 'Content-Type: application/json' -d @-
```

You now have 18 idea winners (3 per prototype) with their element details. These feed into
Phase 6.

## Phase 6: Batch Visual Refinement

All 18 idea winners are processed **in parallel** within each sub-step.

### 6a. Dispatch Visual Critiques (all 18 in parallel)

For each of the 18 idea winners, dispatch the `visual-critique` skill as a **background**
subagent:

```
Read the `visual-critique` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>WINNER_PREVIEW_URL</prototype_images>
<prototype_spec_url>WINNER_SPEC_URL</prototype_spec_url>
```

Dispatch ALL 18 critique subagents in parallel, then wait for ALL to complete.

### 6b. Parse Critiques and Post Comments

From each critique subagent's output, parse the `PROBLEMS:` section — 3-5 problems per
winner. Store these for the variant planners.

For each winner, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: WINNER_SLOT_ID
- text: "Visual Critique:\n\n1. [problem 1]\n2. [problem 2]\n..."

### 6c. Create Placeholder Slots

For each of the 18 idea winners, create a new revision with NUM_VARIANTS placeholder slots at
the appropriate visual row y-position. Each winner's row y comes from the pre-computed layout:

- Winner #1 of prototype P → `visual_row_y[0]` for prototype P
- Winner #2 of prototype P → `visual_row_y[1]` for prototype P
- Winner #3 of prototype P → `visual_row_y[2]` for prototype P

Use the same placeholder creation pattern as Phase 5a. Track which slot IDs belong to which
winner.

### 6d. Dispatch Visual Variant Planners (all 18 in parallel)

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

Dispatch ALL 18 planners in parallel, then wait for ALL to complete.

### 6e. Extract Prompts and Dispatch Content Scripts (all in parallel)

Collect ALL visual variant slot IDs across all 18 winners into one set. Extract uncompleted
prompts matching those slot IDs:

```bash
curl -s "API_HOST/api/projects/PROJECT_ID/events" | python3 -c "
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

### 6f. Collect Previews and Dispatch Visual Picks (all 18 in parallel)

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

Dispatch ALL 18 pick subagents in parallel, then wait for ALL to complete.

### 6g. Parse Winners and Post Comments

From each visual-pick subagent's output, parse the `WINNERS:` section — 3 slot_ids per idea
winner, 54 total.

For each idea winner, call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: #1 visual winner's slot_id
- text: "Pass 2 (Visual Refinement) Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Create 3 visual winner iframe slots at x=NUM_VARIANTS, NUM_VARIANTS+1, NUM_VARIANTS+2 in each
winner's visual row. Same pattern as Phase 5e.

## Phase 7: Summary

Print a final summary:

```
Refinement complete.

Pass 1 (Idea Refinement): 6 prototypes × ~5 variants → 18 idea winners
Pass 2 (Visual Refinement): 18 idea winners × ~5 variants → 54 visual winners

Per prototype:
  Prototype [slot_id]:
    Idea winners: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #1: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #2: [slot_id_1, slot_id_2, slot_id_3]
    Visual winners for idea #3: [slot_id_1, slot_id_2, slot_id_3]
  ...
```

## Important Notes

- **Batch parallelism**: All prototypes (or winners) in a batch are processed in parallel.
  Steps between batches run sequentially. This keeps nesting shallow (max depth 2) while
  maximizing throughput.
- **Pre-computed layout**: All row y-positions are computed upfront so parallel agents never
  create overlapping rows.
- **Prompt text must be passed VERBATIM** to content script subagents.
- **PM and designer evaluation run sequentially** (PM first, then designer) so we can label
  which feedback came from which reviewer.
- **Canvas layout per prototype**: idea variants in row 0, visual variants for each of 3
  idea winners in rows 1-3. Winners graduate to positions after the variants in each row.
