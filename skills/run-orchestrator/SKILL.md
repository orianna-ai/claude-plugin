---
name: run-orchestrator
description: Setup a Softlight project, generate initial prototypes, then refine them through two-pass evaluation and iteration.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__create_comment_thread
model: sonnet
---

# Run Orchestrator

Orchestrate a fully autonomous Softlight design session. This is a **linear pipeline**, not a
loop. You run each phase exactly once, in order:

1. **Setup** — start the app, create a tunnel, generate a problem statement
2. **Project Creation** — create the Softlight project
3. **Generate Initial Prototypes** — use `plan-new-ideas` to generate the first set of designs
4. **Refine** — hand off to the `iterate` skill for evaluation and refinement
5. **Cleanup** — stop background processes

Phase 3 generates prototypes **once**. Do not loop back to Phase 3 or call `plan_prototype_revision`
more than once. All iteration after the initial prototypes is handled by the `iterate` skill in
Phase 4.

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

## Phase 4: Refine

Dispatch the `iterate` skill as a **background** subagent. Pass it:

- The `project_id`
- The user's original prompt

```
Read the `iterate` skill and follow its instructions.

<project_id>PROJECT_ID</project_id>
<user_prompt>USER_PROMPT</user_prompt>
```

Wait for the refinement subagent to complete. This handles everything: screenshotting prototypes,
PM and designer evaluation, idea refinement (12 variants → 3 winners per prototype), and visual
refinement (12 variants → 3 winners per idea winner).

## Phase 5: Cleanup

Run the `stop-tunnel` skill and the `stop-application` skill to kill background processes.
