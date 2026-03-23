---
name: run-orchestrator
description: Setup a Softlight project, generate prototypes, auto-evaluate with PM and designer feedback, generate a revised set of prototypes, and loop.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__create_comment_thread
model: sonnet
---

# Run Orchestrator

Orchestrate a fully autonomous Softlight design session. Generate prototypes, have them reviewed
by a PM and designer, generate a revised set incorporating that feedback, and loop. All design
work is delegated to skills running as background subagents — never do it inline. You MUST run
through all phases in order. Do not stop or ask the user clarifying questions for any reason.

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

## Phase 3: Generate Prototypes

### 3a. Plan and dispatch

Call `plan_prototype_revision` directly with the `project_id`. It creates placeholder slots and
returns:

- `new_ideas_prompt` (always present) + `new_ideas_slot_ids`
- `refine_prompt` (present from round 2 onward, `null` on round 1) + `refine_slot_ids`

Dispatch planner subagents **in parallel** using the Agent tool. For each planner, use these parameters:

```
description: "New ideas planner" (or "Refine planner")
model: "sonnet"
run_in_background: true
prompt: <the full prompt text from plan_prototype_revision, plus the additions below>
```

For each planner subagent prompt, append the following context after the prompt text returned by
`plan_prototype_revision`:

- Remind the subagent to use `http://localhost:8080` as the API host for all `curl` commands
  (the same host as the Softlight MCP server, not a hard-coded production URL).

Dispatch rules:

1. **Always** dispatch `new_ideas_prompt`.
2. If `refine_prompt` is not null, dispatch it **in parallel**
3. **Wait** for all planner subagents to finish before proceeding to 3b.

The planners handle dispatching via the `dispatch_prototype` MCP tool — they write a plan JSON to
a file, upload it to drive, then call `dispatch_prototype` with the `project_id` and `plan_url`,
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
`prompt_completed` event). This matters on second+ revisions where older slot prompts are already
done.

### 3c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent.

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

## Phase 4: Evaluate

### 4a. Screenshot prototypes

Dispatch the `screenshot-iframes` skill in a **background** subagent. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/screenshot-iframes/SKILL.md`
2. The `project_id`

Wait for the screenshot subagent to complete. It uploads screenshots to drive and attaches them
to each iframe slot — reviewers will access them via `get_project`.

### 4b. PM review

Dispatch the `evaluate-prototypes` skill in a **background** subagent. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes/SKILL.md`
2. The `project_id`
3. The problem statement from Phase 1
4. The user's original prompt

Wait for the PM subagent to complete before proceeding to 4c.

### 4c. Designer review and visual design review (parallel)

Dispatch both subagents **in parallel** as **background** subagents:

**Designer review** — dispatch the `evaluate-prototypes-designer` skill. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes-designer/SKILL.md`
2. The `project_id`
3. The problem statement from Phase 1
4. The user's original prompt

**Visual design review** — dispatch the `evaluate-prototypes-visual` skill. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes-visual/SKILL.md`
2. The `project_id`
3. The problem statement from Phase 1
4. The user's original prompt

Wait for **both** subagents to complete before proceeding.

## Phase 5: Loop

Repeat from Phase 3. `plan_prototype_revision` will pick up the PM and designer comment threads
from Phase 4 and use them to plan the next set of prototypes. Continue looping (Phase 3 → Phase 4
→ Phase 3 → …) until the user stops the session.

## Phase 6: Cleanup

Run the `stop-tunnel` skill and the `stop-application` skill to kill background processes.
