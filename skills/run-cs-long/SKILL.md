---
name: run-cs-long
description: Autonomous design loop that generates content-script prototypes, evaluates them, and revises indefinitely without user interaction.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__create_comment
model: sonnet
---

# Run Content Script Long

Autonomously loop through prototype generation, evaluation, and revision. No user interaction
needed — the loop runs until stopped. Do not stop or ask the user clarifying questions for any
reason. You MUST run through all phases and phases must complete before going to the next one.

## Phase 1: Setup

If a user has not input a design problem yet, ask them what design challenge they want to work on.

Use the agent tool to run the setup steps as **background** subagents **in parallel**.

### 1a. Application and Tunnel

Run the `start-environment` skill in a **background** subagent. Pass it the user's input so it
knows which app to start.

### 1b. Problem Statement

Run the `generate-problem-statement` skill in a **background** subagent.

Share the problem statement with the user when it is ready.

Phase 1a - 1b subagents must all complete before going to phase 2.

## Phase 2: Project Creation

Get the current git commit (`git rev-parse HEAD`), then call the `create_project` tool with the
problem statement, tunnel ID, and git commit from Phase 1 (no content script needed). Share the
`project_url` with the user (e.g., `[View in Softlight →](<project_url>)`) and remember the
`project_id` for future interactions.

## Phase 3: Autonomous Design Loop

Repeat this loop indefinitely. Each iteration generates a new revision of prototypes, then
evaluates them.

### 3a. Plan Prototypes

Call `plan_prototype_revision` with `project_id` and `dispatch_prompts` set to `false`.

This creates placeholder slots on the canvas and runs a planning task that analyzes the current
canvas state (problem statement, existing prototypes, reviewer comments) and outputs a JSON plan.
On the first iteration, there will be no existing prototypes or comments — the planner generates
initial design directions from the problem statement alone.

The tool returns `slot_ids` (the placeholder slot IDs) and the task outputs a JSON plan like:

```json
{
  "designs": [
    {
      "slot_id": "placeholder-id",
      "source_slot_id": "existing-proto-id-or-null",
      "spec": "design spec",
      "caption": "reasoning"
    }
  ],
  "unused_slot_ids": ["slot-id-1"]
}
```

Parse the designs from the plan output. If `unused_slot_ids` is non-empty, delete each one:

```
curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
  -H "Content-Type: application/json" \
  -d '[{"type":"slot_deleted","slot_id":"<unused_slot_id>"}]'
```

### 3b. Generate Content Scripts

Launch all N content-script agents **in parallel** as **background** subagents. Send all Agent
tool calls in a single message.

For each design in the plan, use the Agent tool with these parameters:

- **description**: `"Design {i} content script"`
- **model**: `"sonnet"`
- **run_in_background**: `true`
- **prompt**: The full prompt below, with values substituted:

```
Run the generate-content-script skill. Read the skill file first at
/workspaces/orianna/claude-plugin/skills/generate-content-script/SKILL.md, then follow it.

<project_id>PROJECT_ID</project_id>
<slot_id>SLOT_ID</slot_id>
<spec>
THE DESIGN SPEC VERBATIM FROM THE PLAN
</spec>
```

### 3c. Wait for Content Scripts

Wait for **all** background subagents from 3b to complete. Poll each agent's output file until
all have finished.

### 3d. PM Review

Dispatch the `evaluate-prototypes` skill in a **background** subagent. Pass it:
- The path to the skill:
  `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes/SKILL.md`
- The `project_id`
- The problem statement from Phase 1
- The user's original prompt

**Wait for the PM subagent to complete** before proceeding to 3e.

### 3e. Designer Review

Dispatch the `evaluate-prototypes-designer` skill in a **background** subagent. Pass it:
- The path to the skill:
  `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes-designer/SKILL.md`
- The `project_id`
- The problem statement from Phase 1
- The user's original prompt

**Wait for the designer subagent to complete** before proceeding.

### 3f. Loop

Go back to step 3a. The next call to `plan_prototype_revision` will see the PM and designer
comments on the canvas and use them to plan the next revision.

## Phase 4: Cleanup

Run the `stop-tunnel` skill and then the `stop-application` skill to kill background processes.
