---
name: run-visual-refinement
description: >
  Two-pass refinement loop for Softlight prototypes. Pass 1: incorporate PM/designer feedback
  to evolve ideas (12 variants → pick top 3). Pass 2: visual polish on each winner (12 variants
  → pick top 3). Result: 9 final prototypes per original. All prototypes processed in parallel.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__dispatch_prototype, mcp__plugin_softlight_softlight__create_comment_thread
model: sonnet
---

# Run Two-Pass Refinement

Orchestrate a two-pass refinement loop on existing Softlight prototypes. Pass 1 evolves ideas
using PM and product designer feedback. Pass 2 polishes visual design. All prototypes are
processed in parallel. All work is delegated to skills running as background subagents.
Do not stop or ask clarifying questions.

## Inputs

You will receive:

- **`<project_id>`** — Softlight project UUID (from the test harness)

## Constants

```
IFRAME_WIDTH = 1720
IFRAME_HEIGHT = 1120
IFRAME_STRIDE = 1840
IFRAME_ROW_GAP = 1000
ROW_HEIGHT = 2120  # IFRAME_HEIGHT + IFRAME_ROW_GAP
NUM_VARIANTS = 12
NUM_WINNERS = 3
ROWS_PER_PROTOTYPE = 4  # 1 idea row + 3 visual rows (one per idea winner)
API_HOST = http://localhost:8080
```

## Phase 1: Get Project State and Pre-Compute Layout

Call `get_project` with the `project_id`. From the response:

1. Extract the **problem statement** from `problem.text`.
2. Extract **baseline screenshots** from `problem.attachments` — save the URLs.
3. Find all iframe slots in **revision 1** (the first revision). These are the prototypes to refine.
4. For each iframe slot, note:
   - `slot_id`
   - `element.content_script.url` — the Drive URL of the content script
   - `element.spec_url` — the spec URL
   - `element.tunnel_id` — the tunnel ID
   - `element.git_commit` — the git commit
   - `element.git_patch` — the git patch attachment (if any)
   - `element.preview.url` if it exists — the auto-captured preview screenshot
   - `element.screenshots` — list of screenshot attachments

### Pre-compute row y-positions

Find the maximum bottom edge of all existing slots: `max(slot.y + slot.height)` across all
revisions. Call this `base_y_start`. Add `IFRAME_ROW_GAP` to get the first new row's y-position.

Each prototype owns a contiguous block of 4 rows:

```
For prototype index P (0-based):
  Row 0 (Pass 1 — idea variants):     y = base_y + (P * 4 + 0) * ROW_HEIGHT
  Row 1 (Pass 2 — visual for winner #1): y = base_y + (P * 4 + 1) * ROW_HEIGHT
  Row 2 (Pass 2 — visual for winner #2): y = base_y + (P * 4 + 2) * ROW_HEIGHT
  Row 3 (Pass 2 — visual for winner #3): y = base_y + (P * 4 + 3) * ROW_HEIGHT

Where base_y = base_y_start + IFRAME_ROW_GAP
```

Build a mapping of `(prototype_index) → [row_0_y, row_1_y, row_2_y, row_3_y]` and pass the
relevant row y-positions to each prototype's refinement subagent.

## Phase 2: Screenshot Prototypes

Dispatch the `screenshot-iframes` skill as a **background** subagent to capture screenshots
for the PM and designer evaluators:

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
<user_prompt>PROBLEM_STATEMENT</user_prompt>
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
<user_prompt>PROBLEM_STATEMENT</user_prompt>
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

## Phase 5: Pass 1 — Idea Refinement (all prototypes in parallel)

For each prototype from revision 1, dispatch a **background** subagent that runs the idea
refinement pass. Each subagent gets its pre-computed row y-positions and the labeled feedback.

Dispatch ALL idea refinement subagents **in parallel**, then wait for ALL to complete.

Each subagent prompt should follow this structure:

---

### Per-Prototype Idea Refinement Subagent Prompt

```
You are running Pass 1 (Idea Refinement) for a single prototype. Follow these instructions
exactly. Do not stop or ask clarifying questions.

<project_id>PROJECT_ID</project_id>

<problem_statement>
PROBLEM_STATEMENT_TEXT
</problem_statement>

<baseline_images>
BASELINE_URL_1
BASELINE_URL_2
...
</baseline_images>

<prototype>
slot_id: SLOT_ID
content_script_url: CONTENT_SCRIPT_URL
spec_url: SPEC_URL
tunnel_id: TUNNEL_ID
git_commit: GIT_COMMIT
git_patch_url: GIT_PATCH_URL_OR_NONE
preview_url: PREVIEW_URL
screenshot_urls: SCREENSHOT_URL_1, SCREENSHOT_URL_2, ...
</prototype>

<feedback>
**PM Feedback:**
[pm feedback text]

**Product Designer Feedback:**
[designer feedback text]
</feedback>

<row_positions>
pass1_row_y: Y_VALUE
pass2_winner1_row_y: Y_VALUE
pass2_winner2_row_y: Y_VALUE
pass2_winner3_row_y: Y_VALUE
</row_positions>

<constants>
IFRAME_WIDTH = 1720
IFRAME_HEIGHT = 1120
IFRAME_STRIDE = 1840
NUM_VARIANTS = 12
NUM_WINNERS = 3
API_HOST = http://localhost:8080
</constants>

## Pass 1: Idea Refinement

### Step 1a: Create Placeholder Slots

Generate 12 UUIDs and create a new revision with 12 placeholder slots at pass1_row_y:

python3 -c "
import json, uuid

slot_ids = [str(uuid.uuid4()) for _ in range(12)]
base_y = PASS1_ROW_Y
stride = 1840
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
for sid in slot_ids:
    print(f'SLOT_ID={sid}', file=__import__('sys').stderr)
" 2>/tmp/slot_ids.txt | curl -s -X POST "API_HOST/api/projects/PROJECT_ID/events" \
    -H 'Content-Type: application/json' -d @-

Save the slot IDs from stderr output.

### Step 1b: Dispatch Idea Variant Planning

Dispatch the `idea-variant-plan` skill as a **background** subagent:

Read the `idea-variant-plan` skill and follow its instructions.

Reminder: use http://localhost:8080 as the API host for all curl commands.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<feedback>
FULL_LABELED_FEEDBACK_BLOCK
</feedback>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>PROTOTYPE_PREVIEW_AND_SCREENSHOT_URLS</prototype_images>
<prototype_spec_url>SPEC_URL</prototype_spec_url>
<slot_ids>
SLOT_ID_1
SLOT_ID_2
...
SLOT_ID_12
</slot_ids>
<content_script_url>CONTENT_SCRIPT_URL</content_script_url>
<project_id>PROJECT_ID</project_id>

Wait for the variant planner to complete.

### Step 1c: Extract and Dispatch Content Script Subagents

Read the per-item prompts from the event history, filtering to ONLY the slot IDs you created
in Step 1a. This is critical — multiple prototypes run in parallel and all post events to the
same project, so you must filter by your specific slot IDs to avoid picking up another
prototype's prompts.

curl -s "API_HOST/api/projects/PROJECT_ID/events" | python3 -c "
import json, sys

# IMPORTANT: Replace with the actual slot IDs from Step 1a
my_slot_ids = set(['SLOT_ID_1', 'SLOT_ID_2', ...])

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
        # Only match prompts for OUR slot IDs
        slot_id = key.replace('slot:', '') if key.startswith('slot:') else ''
        if slot_id in my_slot_ids and pid not in completed_ids:
            print(f'PROMPT_ID={pid} KEY={key}')
            print('---TEXT_START---')
            print(prompt.get('text', ''))
            print('---TEXT_END---')
"

Only process prompts for YOUR slot IDs that have NOT already been completed.

For each per-item prompt, dispatch a **background** subagent:

PROMPT_TEXT_VERBATIM

After completing the content script, mark this prompt as done:

curl -s -X POST "http://localhost:8080/api/projects/PROJECT_ID/events" \
  -H "Content-Type: application/json" \
  -d '[{"type":"prompt_completed","prompt_id":"PROMPT_ID"}]'

**CRITICAL: Pass the prompt text VERBATIM — every character, every tag, every URL. Do not
summarize, shorten, paraphrase, or omit any part of it.**

Dispatch ALL content script subagents in parallel as background subagents. Then wait for ALL
of them to complete.

### Step 1d: Collect Variant Previews

Call `get_project` to get the updated project state. Find all slots in the latest revision that
now have an IFrameElement (not placeholder). Each iframe has a `preview` attachment with a `url`
field — this is the auto-captured screenshot.

Build a list of {slot_id, preview_url} pairs. If any variants failed (still placeholder), note
them but proceed with the ones that succeeded.

### Step 1e: Idea Pick

Dispatch the `idea-pick` skill as a **background** subagent:

Read the `idea-pick` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<original_prototype_images>ORIGINAL_PROTOTYPE_PREVIEW_URL</original_prototype_images>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
slot_id=SLOT_ID_2 preview_url=PREVIEW_URL_2
...
</variant_previews>
<feedback>
FULL_LABELED_FEEDBACK_BLOCK
</feedback>

Wait for the subagent to complete. Parse the output:
- Extract WINNERS: section — 3 entries, each with a slot_id and reason

### Step 1f: Post Idea Winner Comment and Create Winner Iframe Slots

Call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: [#1 winner's slot_id]
- text: "Pass 1 (Idea Refinement) Winners:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Then call `get_project` and find the 3 winning slots' IFrameElements. For each winner, store:
- slot_id
- element.content_script.url
- element.preview.url
- element.tunnel_id
- element.git_commit
- element.spec_url
- element.git_patch (if any)

Also create the 3 winner iframe slots at x=12,13,14 in the Pass 1 row so they're visually
distinguished as graduates:

python3 -c "
import json, uuid

winners = [
    {'tunnel_id': 'TID', 'git_commit': 'COMMIT', 'content_script_url': 'URL', 'spec_url': 'SPEC', 'preview_url': 'PREV', 'git_patch_url': 'PATCH_OR_NULL'},
    # winner 2, winner 3
]
base_y = PASS1_ROW_Y
stride = 1840

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
            'x': float((12 + j) * stride),
            'y': base_y
        }
    })
print(json.dumps(events))
" | curl -s -X POST "API_HOST/api/projects/PROJECT_ID/events" \
    -H 'Content-Type: application/json' -d @-

## Pass 2: Visual Refinement (for each of the 3 idea winners)

For each of the 3 idea winners (winner index W = 0, 1, 2), run one round of visual refinement.
Process all 3 winners **in parallel** (dispatch 3 background subagents simultaneously).

For each winner W:

### Step 2a: Visual Critique

Dispatch the `visual-critique` skill as a **background** subagent:

Read the `visual-critique` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>WINNER_PREVIEW_URL</prototype_images>
<prototype_spec_url>WINNER_SPEC_URL</prototype_spec_url>

Wait for the subagent to complete. Parse the PROBLEMS: section.

### Step 2b: Post Visual Critique Comment

Call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: WINNER_SLOT_ID
- text: "Visual Critique:\n\n1. [problem 1]\n2. [problem 2]\n..."

### Step 2c: Create Placeholder Slots

Generate 12 UUIDs and create a new revision with 12 placeholder slots at this winner's
pre-computed row y-position (pass2_winnerW_row_y):

(Same pattern as Step 1a, but using the Pass 2 row y-position for this winner)

### Step 2d: Dispatch Visual Variant Planning

Dispatch the `visual-variant-plan` skill as a **background** subagent:

Read the `visual-variant-plan` skill and follow its instructions.

Reminder: use http://localhost:8080 as the API host for all curl commands.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<problems>
1. [problem 1 from critique]
2. [problem 2 from critique]
...
</problems>
<baseline_images>BASELINE_URLS</baseline_images>
<prototype_images>WINNER_PREVIEW_URL</prototype_images>
<slot_ids>
SLOT_ID_1
...
SLOT_ID_12
</slot_ids>
<content_script_url>WINNER_CONTENT_SCRIPT_URL</content_script_url>
<project_id>PROJECT_ID</project_id>

Wait for the variant planner to complete.

### Step 2e-2f: Extract Prompts, Dispatch Content Scripts, Collect Previews

Same as Steps 1c and 1d — but filter prompts by the slot IDs created in Step 2c (not 1a).
This is critical since multiple visual refinement passes run in parallel.

### Step 2g: Visual Pick

Dispatch the `visual-pick` skill as a **background** subagent:

Read the `visual-pick` skill and follow its instructions.

<problem_statement>PROBLEM_STATEMENT</problem_statement>
<baseline_images>BASELINE_URLS</baseline_images>
<original_prototype_images>WINNER_PREVIEW_URL</original_prototype_images>
<variant_previews>
slot_id=SLOT_ID_1 preview_url=PREVIEW_URL_1
...
</variant_previews>
<problems>
1. [problem 1]
...
</problems>
<round>1</round>
<is_last_round>true</is_last_round>

Wait for the subagent to complete. Parse WINNERS: section — 3 entries.

### Step 2h: Post Visual Winner Comment and Create Winner Iframe Slots

Call `create_comment_thread` with:
- project_id: PROJECT_ID
- prototype_slot_id: [#1 visual winner's slot_id]
- text: "Pass 2 (Visual Refinement) Winners for idea winner #W:\n\n#1: [slot_id] — [reason]\n#2: [slot_id] — [reason]\n#3: [slot_id] — [reason]"

Create 3 visual winner iframe slots at x=12,13,14 in this winner's Pass 2 row.
(Same pattern as Step 1f winner slot creation, using Pass 2 row y-position)

## After Both Passes Complete

Print a summary for this prototype:

Prototype [original_slot_id]: Two-pass refinement complete
  Pass 1 (Idea) winners: [slot_id_1, slot_id_2, slot_id_3]
  Pass 2 (Visual) for idea winner #1: [slot_id_1, slot_id_2, slot_id_3]
  Pass 2 (Visual) for idea winner #2: [slot_id_1, slot_id_2, slot_id_3]
  Pass 2 (Visual) for idea winner #3: [slot_id_1, slot_id_2, slot_id_3]
  Total final prototypes: 9
```

---

## Phase 6: Summary

After all prototype refinement subagents complete, print a final summary listing each
prototype's original slot ID, its 3 idea winners, and its 9 final visual winners.

The canvas will show, for each original prototype:
- Row 1: 12 idea variants + 3 graduated winners (at positions 12-14)
- Row 2: 12 visual variants for idea winner #1 + 3 graduated winners
- Row 3: 12 visual variants for idea winner #2 + 3 graduated winners
- Row 4: 12 visual variants for idea winner #3 + 3 graduated winners

Comment threads show PM feedback, designer feedback, idea winner reasoning, visual critique
problems, and visual winner reasoning at each step.

## Important Notes

- **Parallelism**: All original prototypes are refined in parallel. Within each prototype,
  the 3 visual refinement passes (one per idea winner) also run in parallel. Content script
  subagents within each pass run in parallel.
- **Pre-computed layout**: Row y-positions are computed upfront so parallel agents never
  create overlapping rows.
- **Canvas visibility**: Variants appear in real-time as each content script subagent completes.
  Winners are persisted as iframe slots at positions 12-14 in each row.
- **Comment threads**: PM feedback, designer feedback, idea graduation, visual critique, and
  visual graduation are all posted as comment threads on the canvas.
- **All variants are kept on canvas** — no cleanup between passes.
- **Prompt text must be passed VERBATIM** to content script subagents.
- **PM and designer evaluation run sequentially** (PM first, then designer) so we can label
  which feedback came from which reviewer.
