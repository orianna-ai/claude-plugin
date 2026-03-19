---
name: test-prototype-generation
description: >
  Simulate prototype generation end-to-end. Sets up a tunnel, updates the project,
  creates placeholder slots, and dispatches hardcoded edit-content-script prompts.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__wait_for_prompt
model: sonnet
---

# Test Prototype Generation

Simulate a full prototype generation cycle against an existing Softlight project. This is a
test harness — the plan items are hardcoded.

## Inputs

The user must provide:

- **`project_id`** — UUID of an existing Softlight project (visible in the URL at `softlight.orianna.ai/projects/<id>`)
- **`port`** — local port where the target application is running

## Phase 1: Tunnel Setup

Run the `start-tunnel` skill to expose the app at `port`. This gives you a `tunnel_url` and
`frpc_pid`.

## Phase 2: Update Project Problem

The project needs a `tunnel_url` on its `problem` so that iframe prototypes can load the
tunneled application. Post a `project_updated` event via the REST API:

**IMPORTANT:** The body must be a **bare JSON array** `[...]`, NOT an object like
`{"events": [...]}`. The FastAPI endpoint expects `Sequence[Event]` as the body directly.

```bash
curl -s -X POST \
  "http://localhost:8080/api/projects/${PROJECT_ID}/events" \
  -H "Content-Type: application/json" \
  -d '[{"type":"project_updated","problem":{"text":"Test prototype generation","tunnel_url":"'"${TUNNEL_URL}"'"}}]'
```

After posting, verify the project state and confirm `problem.tunnel_url` is set:

```bash
curl -s "http://localhost:8080/api/projects/${PROJECT_ID}"
```

## Phase 3: Create Placeholders and Dispatch Subagents

### 3a. Generate slot IDs

Generate two UUIDs:

```bash
python3 -c "import uuid; print(uuid.uuid4()); print(uuid.uuid4())"
```

Call these `SLOT_ID_1` and `SLOT_ID_2`.

### 3b. Create placeholders, captions, and prompt events

Write a Python script to `/tmp/test_proto_setup.py` and run it. This script must:

1. POST a batch of events to create the revision, placeholder slots, and text captions
2. POST a batch of `prompt_created` events (so the UI shows loading spinners)
3. Print the slot IDs back for confirmation

Here is the script — substitute `PROJECT_ID`, `SLOT_ID_1`, `SLOT_ID_2` with actual values:

```python
import json
import urllib.request

PROJECT_ID = "<substitute>"
SLOT_ID_1 = "<substitute>"
SLOT_ID_2 = "<substitute>"
API = f"http://localhost:8080/api/projects/{PROJECT_ID}/events"

PLAN_1 = {"slot_id":None,"content_script":None,"title":None,"change_description":"Implement an interactive data grid with a global search input field positioned above it. The search bar should filter the table in real-time. Typing a domain string (e.g., '@acme.com') must instantly filter the grid to show only rows where the account email contains that string. Ensure the Account column displays both user name and email address.","feedback":[{"comment_text":"make this as a prototype","comment_screenshot":"https://drive.orianna.ai/bafbb4bf68411fe443da6ef9535311ee.png","user_attached_images":[],"anchor_selectors":[],"anchor_html":None,"anchor_location":None}],"design_mocks":["https://drive.orianna.ai/7e35031a31af5d4b0ddf7fee20edd89d.webp"]}

PLAN_2 = {"slot_id":None,"content_script":None,"title":None,"change_description":"Implement an interactive data grid with a right-hand sidebar panel. The panel must include a 'Group by' section with an 'Email Domain' checkbox. When checked, dynamically group the table rows by the domain parsed from the user accounts. Grouped rows should be collapsible/expandable. Show 'Multiple' for mixed text values in group headers.","feedback":[{"comment_text":"make this as a prototype","comment_screenshot":"https://drive.orianna.ai/cd432f006143593a63daa28a123285de.png","user_attached_images":[],"anchor_selectors":[],"anchor_html":None,"anchor_location":None}],"design_mocks":["https://drive.orianna.ai/0836296b7d934c1ce7da9c5140af583c.webp"]}

def post(events):
    data = json.dumps(events).encode()
    req = urllib.request.Request(API, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# Batch 1: revision + placeholders + captions
post([
    {"type": "revision_created", "revision": {}},
    {"type": "slot_created", "slot": {"element": {"type": "placeholder"}, "metadata": {"id": SLOT_ID_1}, "width": 1720, "height": 1120, "x": 0, "y": 0}},
    {"type": "slot_created", "slot": {"element": {"type": "placeholder"}, "metadata": {"id": SLOT_ID_2}, "width": 1720, "height": 1120, "x": 1840, "y": 0}},
    {"type": "slot_created", "slot": {"element": {"type": "text", "text": PLAN_1["change_description"], "variant": "small"}, "width": 1720, "height": 200, "x": 0, "y": 1160}},
    {"type": "slot_created", "slot": {"element": {"type": "text", "text": PLAN_2["change_description"], "variant": "small"}, "width": 1720, "height": 200, "x": 1840, "y": 1160}},
])

# Batch 2: prompt events (drives loading spinners in the UI)
def make_prompt(plan, slot_id):
    plan_json = json.dumps(plan)
    return f"""Run the edit-content-script skill to generate a content script for this plan item. Read the skill file first, then follow it. The skill's Step 4 handles uploading and placing the content script on the canvas.

CRITICAL: Pass this ENTIRE prompt to the subagent verbatim — every character of the <plan_item> JSON and every <tag> below must survive intact. Do not rephrase, summarize, or convert any part to prose.

<plan_item>
{plan_json}
</plan_item>
<project_id>{PROJECT_ID}</project_id>
<slot_id>{slot_id}</slot_id>"""

result = post([
    {"type": "prompt_created", "prompt": {"key": f"slot:{SLOT_ID_1}", "text": make_prompt(PLAN_1, SLOT_ID_1)}},
    {"type": "prompt_created", "prompt": {"key": f"slot:{SLOT_ID_2}", "text": make_prompt(PLAN_2, SLOT_ID_2)}},
])

# Extract the server-assigned prompt IDs
for event in result:
    prompt = event.get("prompt", {})
    meta = prompt.get("metadata", {})
    print(f"prompt_id={meta.get('id')} key={prompt.get('key')}")
```

Run it:

```bash
python3 /tmp/test_proto_setup.py
```

This prints two `prompt_id` values. Save them as `PROMPT_ID_1` and `PROMPT_ID_2`.

### 3c. Dispatch background subagents

Immediately after step 3b, dispatch **two background subagents in parallel**. Do NOT use
`wait_for_prompt` — launch them directly.

Each subagent must receive:

1. The full prompt text (same as what was posted in the `prompt_created` event)
2. An instruction to mark the prompt as done via curl when finished

**Subagent 1** — pass verbatim:

```
You are handling a Softlight prompt for project_id: <PROJECT_ID>, prompt_id: <PROMPT_ID_1>.

Run the edit-content-script skill to generate a content script for this plan item. Read the skill file first at /workspaces/orianna/claude-plugin/skills/edit-content-script/SKILL.md, then follow it. The skill's Step 4 handles uploading and placing the content script on the canvas.

CRITICAL: The ENTIRE prompt content below must be passed verbatim — every character of the plan_item JSON and every tag must survive intact.

<plan_item>
<PLAN_1_JSON>
</plan_item>
<project_id><PROJECT_ID></project_id>
<slot_id><SLOT_ID_1></slot_id>

After completing all work, mark the prompt as done:
curl -s -X POST "http://localhost:8080/api/projects/<PROJECT_ID>/events" \
  -H "Content-Type: application/json" \
  -d '[{"type":"prompt_completed","prompt_id":"<PROMPT_ID_1>"}]'
```

**Subagent 2** — same structure but with `PLAN_2_JSON`, `SLOT_ID_2`, and `PROMPT_ID_2`.

For `PLAN_1_JSON` and `PLAN_2_JSON`, use the exact JSON blobs from the script above
(the `PLAN_1` and `PLAN_2` dictionaries serialized to JSON).

## Phase 4: Prompt Loop

After dispatching both subagents, enter the standard prompt-handling loop for any future
user interactions from the canvas:

1. Call `wait_for_prompt` with the `project_id`. On the first call, omit `prompt_id`.
2. When a prompt arrives, dispatch it to a **background** subagent. Instruct the subagent to
   mark the prompt as done when finished by running:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```
3. Loop back to step 1 immediately — do not wait for the subagent.

## Output

Share the project URL with the user: `http://localhost:8080/projects/{project_id}`
