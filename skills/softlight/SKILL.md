---
name: softlight
description: Setup a Softlight project and then continuously listen for created prompts and dispatch them to background subagents for completion.
---

# Softlight

Orchestrate a Softlight design session. Delegate all design work to skills — never do it inline. You MUST run through all phases. Do not stop or ask the user for anything (unless the phase specifies it) - keep going.

## Phase 1: Analysis

Dispatch the `code-analysis` agent. It produces a structured analysis of the codebase
(selectors, design tokens, component structure, API shapes, routing) and caches it by app name.
Every downstream agent receives this analysis.

## Phase 2: Setup

Run these three tasks as subagents, passing the application analysis to each. **All three Task
calls MUST be in a single message** so they run concurrently — do not send them sequentially:

### 2a. Content Script

Run `generate-content-script` to configure the application's initial state.

### 2b. Application and Tunnel

Run `start-application` to serve the app on a free port, then `start-tunnel` to expose it.

### 2c. Problem Statement

Run `generate-problem-statement`. If the user hasn't described the challenge, ask first.

Share the problem statement with the user.

## Phase 3: Project Creation

Call `create_project` with the problem statement, content script, and tunnel URL from Phase 2.

Share the project URL: `[View in Softlight →](<project_url>)`.

Dispatch `generate_mock_revision` in a **background** sub-agent to create the initial revision.
Do not wait for it — proceed immediately to Phase 4.

## Phase 4: Prompt Handling

Loop indefinitely:

1. `wait_for_prompt` with `project_id`. Pass the `prompt_id` from the previous call.

2. Analyze the prompt and determine which skill to dispatch.

3. Dispatch to a **background** sub-agent. Include the application analysis from Phase 1. Instruct
   it to call `complete_prompt` with `project_id` and `prompt_id` when done.
   
4. Loop back to step 1 immediately — do not wait for the subagent.

## Phase 5: Cleanup

Run `stop-application` and `stop-tunnel` to kill background processes.
