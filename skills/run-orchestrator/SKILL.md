---
name: run-orchestrator
description: Setup a Softlight project and then continuously listen for created prompts and dispatch them to background subagents for completion.
allowed-tools: Bash, Read, Write, Glob, Grep, mcp__plugin_softlight_softlight__create_project, mcp__plugin_softlight_softlight__generate_mock_revision, mcp__plugin_softlight_softlight__wait_for_prompt, mcp__plugin_softlight_softlight__plan_prototype_revision, mcp__plugin_softlight_softlight__create_comment, mcp__plugin_softlight_softlight__generate_prototype_revision
model: sonnet
---

# Run Orchestrator

Orchestrate a Softlight design session. Delegate all design work to skills running as background
subagents — never do it inline. You MUST run through all phases and phases must complete before going to the next one. Do not stop or ask the user clarifying questions for any reason.

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

Call the `generate_mock_revision` tool directly with the `project_id`. Do not spawn a subagent —
this tool supports task execution and should be called inline. Proceed to Phase 3 after it returns.

## Phase 3: Prompt Handling

Loop indefinitely:

1. Call the `wait_for_prompt` tool with `project_id`. Pass the `prompt_id` from the previous call.

2. If the returned prompt has `key` equal to `"cancel"`, the user clicked **Stop** in the UI.
   **Break out of the loop immediately** and proceed to Phase 4 (Cleanup). Do not dispatch any
   further subagents.

3. If the returned prompt has `key` equal to `"ai_review"`, run the evaluation sub-flow:

   **3a. PM review** — Dispatch the `evaluate-prototypes` skill in a **background** subagent.
   Pass it:
   - The path to the skill:
     `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes/SKILL.md`
   - The `project_id`
   - The problem statement from Phase 1
   - The user's original prompt

   **Wait for the PM subagent to complete** before proceeding to 3b.

   **3b. Designer review** — Dispatch the `evaluate-prototypes-designer` skill in a **background**
   subagent. Pass it:
   - The path to the skill:
     `/workspaces/orianna/claude-plugin/skills/evaluate-prototypes-designer/SKILL.md`
   - The `project_id`
   - The problem statement from Phase 1
   - The user's original prompt

   **Wait for the designer subagent to complete** before proceeding to 3c.

   **3c. Generate next revision** — Call `plan_prototype_revision` directly with the `project_id`.
   It reads the PM and designer comment threads from the canvas and plans the next set of
   prototypes. Mark the `ai_review` prompt as done and loop back to step 1 — the per-slot prompts
   from `plan_prototype_revision` will arrive as subsequent prompts.

4. If the prompt only requires calling a single Softlight MCP tool (e.g. `generate_mock_revision`,
   `plan_prototype_revision`), call the tool **directly** — do not spawn a subagent. After the tool
   returns, mark the prompt as done and loop back to step 1:
   ```
   curl -s -X POST "https://softlight.orianna.ai/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

5. Otherwise, dispatch the skill in a **background** subagent. You must instruct the subagent to
   mark the prompt as done when it is finished by running:
   ```
   curl -s -X POST "https://softlight.orianna.ai/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```
   Loop back to step 1 immediately — do not wait for the subagent.

## Phase 4: Cleanup

Run the `stop-tunnel` skill and then the `stop-application` skill to kill background processes.
