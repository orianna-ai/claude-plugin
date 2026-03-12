---
name: softlight
description: Setup a Softlight project and then continuously listen for created prompts and dispatch them to background subagents for completion.
model: haiku
---

# Softlight

Orchestrate a Softlight design session. Delegate all design work to skills running as background
subagents — never do it inline. You MUST run through all phases. Do not stop or ask the user
clarifying questions for any reason.

## Phase 1: Setup

Use the agent tool to run the setup tasks as **background** subagents **in parallel**.

### 1a. Content Script

Run the `generate-content-script` skill in a **background** subagent to get the app into the right
state for screenshotting. Pass it the user's design problem so it can figure out which screen and
state to show.

### 1b. Application and Tunnel

Run the `start-application` skill and then the `start-tunnel` skill in a **background** subagent.

### 1c. Problem Statement

Run the `generate-problem-statement` skill in a **background** subagent.

Share the problem statement with the user when it is ready.

## Phase 2: Project Creation

Call the `create_project` tool with the problem statement, content script, and tunnel URL from
Phase 1. Share the `project_url` with the user (e.g., `[View in Softlight →](<project_url>)`) and
remember the `project_id` for future interactions.

Call the `generate_mock_revision` tool in a **background** subagent and immediately proceed to
Phase 3.

## Phase 3: Prompt Handling

Loop indefinitely:

1. Call the `wait_for_prompt` tool with `project_id`. Pass the `prompt_id` from the previous call.

2. Analyze the prompt, determine which skill to dispatch, dispatch the skill in a **background**
   subagent. You must instruct the subagent to call the `complete_prompt` tool with the `project_id`
   and `prompt_id` when it is done handling the prompt.
   
3. Loop back to step 1 immediately — do not wait for the subagent.

## Phase 4: Cleanup

Run the `stop-tunnel` skill and then the `stop-application` skill to kill background processes.
