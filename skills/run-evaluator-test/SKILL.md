---
name: run-evaluator-test
description: >
  Run a single automated design evaluation cycle: generate prototypes, evaluate them with
  AI-generated feedback, and generate a second revision incorporating that feedback.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__screenshot_prototype, mcp__plugin_softlight_softlight__create_comment_thread
model: sonnet
---

# Run Evaluator Test

Run a fully automated design evaluation cycle. This skill generates prototypes from a design
problem, evaluates them, gives design feedback, and generates a second revision — all without
human intervention. You MUST run through all phases in order. Do not stop or ask the user
clarifying questions for any reason.

## Phase 1: Setup

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

## Phase 3: First Prototype Generation

### 3a. Plan and fire prompts

Call `plan_prototype_revision` directly with the `project_id`. It returns `slot_ids` — one per
prototype it plans to generate. It also fires a `PromptCreatedEvent` per slot into the event bus.

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

This gives you the prompt text and prompt_id for each per-item prompt.

### 3c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent. Pass it:

1. The full prompt text verbatim (including the `<plan_item>`, `<project_id>`, and `<slot_id>` tags)
2. The path to the edit-content-script skill:
   `/workspaces/orianna/claude-plugin/skills/edit-content-script/SKILL.md`
3. Instructions to mark the prompt as done when finished:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

### 3d. Wait for completion

Wait for **all** background subagents from step 3c to complete before proceeding. Do not move to
Phase 4 until every prototype has been generated.

## Phase 4: Evaluate

### 4a. PM review

Dispatch the `evaluate-prototypes` skill in a **background** subagent. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes/SKILL.md`
2. The `project_id`
3. The problem statement from Phase 1
4. The user's original prompt

Wait for the PM subagent to complete before proceeding to 4b.

### 4b. Designer review

Dispatch the `evaluate-prototypes-designer` skill in a **background** subagent. Pass it:

1. The path to the skill:
   `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes-designer/SKILL.md`
2. The `project_id`
3. The problem statement from Phase 1
4. The user's original prompt

Wait for the designer subagent to complete before proceeding to Phase 5.

## Phase 5: Second Prototype Generation

Repeat Phase 3 exactly (steps 3a through 3d). Call `plan_prototype_revision` again — it will pick
up the feedback comments from Phase 4 and generate revised prototypes.

## Phase 6: Done

Share the project URL with the user:

> **Evaluation complete.** Two prototype revisions have been generated. The first revision is the
> initial design direction. The second revision incorporates automated design feedback.
>
> [View in Softlight →](<project_url>)

Then run the `stop-tunnel` skill and the `stop-application` skill to clean up.
