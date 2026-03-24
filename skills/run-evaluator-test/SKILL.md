---
name: run-evaluator-test
description: >
  Run a single automated design evaluation cycle: generate prototypes, evaluate them with
  AI-generated feedback, and generate a second revision incorporating that feedback.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__create_comment_thread, mcp__plugin_softlight_softlight__get_pending_prompts, mcp__plugin_softlight_softlight__complete_prompt
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

Call `plan_prototype_revision` directly with the `project_id`. It creates placeholder slots and
returns:

- `new_ideas_prompt` (always present) + `new_ideas_slot_ids`
- `refine_prompt` (present from round 2 onward, `null` on round 1) + `refine_slot_ids`

Dispatch planner subagents using the Agent tool. For each planner, use these parameters:

```
description: "New ideas planner" (or "Refine planner")
model: "sonnet"
run_in_background: true
prompt: <the full prompt text from plan_prototype_revision, plus the additions below>
```

Dispatch rules:

1. **Always** dispatch `new_ideas_prompt`.
2. If `refine_prompt` is not null, dispatch it **in parallel** (same message, two Agent calls).
3. **Wait** for all planner subagents to finish before proceeding to 3b.

### 3b. Extract per-item prompts

Call `get_pending_prompts` with the `project_id`. This returns all uncompleted `slot:*` prompts —
each with a `prompt_id`, `slot_id`, and full `text`.

### 3c. Dispatch subagents

For each per-item prompt, dispatch a **background** subagent. Pass it:

1. The full prompt text verbatim (including the `<plan_item>`, `<project_id>`, and `<slot_id>` tags)
2. Instructions to run the `generate-content-script` skill
3. Instructions to mark the prompt as done when finished by calling `complete_prompt` with
   the `project_id` and `prompt_id`.

### 3d. Wait for completion

Wait for **all** background subagents from step 3c to complete before proceeding. Do not move to
Phase 4 until every prototype has been generated.

## Phase 4: Evaluate

### 4a. Screenshot prototypes

Dispatch the `screenshot-iframes` skill in a **background** subagent. Pass it the `project_id`.

Wait for the screenshot subagent to complete. It uploads screenshots to drive and attaches them
to each iframe slot — reviewers will access them via `get_project`.

### 4b. PM review

Dispatch the `evaluate-prototypes` skill in a **background** subagent. Pass it:

1. The `project_id`
2. The problem statement from Phase 1
3. The user's original prompt

Wait for the PM subagent to complete before proceeding to 4c.

### 4c. Designer review and visual design review (parallel)

Dispatch both subagents **in parallel** as **background** subagents:

**Designer review** — dispatch the `evaluate-prototypes-designer` skill. Pass it:

1. The `project_id`
2. The problem statement from Phase 1
3. The user's original prompt

**Visual design review** — dispatch the `evaluate-prototypes-visual` skill. Pass it:

1. The `project_id`
2. The problem statement from Phase 1
3. The user's original prompt

Wait for **both** subagents to complete before proceeding to Phase 5.

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
