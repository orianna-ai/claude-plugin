---
name: test-harness
description: Replay an events file against a local Softlight instance. Sets up worktrees, builds applications, starts tunnels, posts events, and returns the project URL.
---

# Run Test Harness

Replay a recorded events file end-to-end against a local Softlight instance.

## Input

The user provides the name of an file in `events/` without `.json` extension.

## Step 1: Setup Worktrees

Run the setup script to create all git worktrees that are referenced by the events file:

```bash
python3 ./setup_worktrees.py <file_name>
```

The script prints a JSON array. Each object has `tunnel_id`, `git_commit`, `git_patch_url`, `id`,
and a `path` (the worktree directory on disk). Parse this output — you will need it for the next
step.

## Step 2: Start Applications and Tunnels

For **each worktree** from Step 1, launch a **background subagent** with the `path` as its working
directory that does the following:

1. Run the `start-application` skill to start the app. Use the name of the events file as a hint
   about what application to run. Pass the path so it knows where the app lives.
  
2. Once the app is running and you have a `PORT`, run the `start-tunnel` skill to create a tunnel.
   The tunnel must use the worktree's `tunnel_id` — this is how the events file references it.

Launch all worktree subagents **in parallel**. Wait for all of them to complete before proceeding.

## Step 3: Setup Project

Once all tunnels are live, post the events to the local MCP server:

```bash
python3 ./setup_project.py <file_name>
```

The script prints the `project_id`.

## Step 4: Output

Print the project URL:

```
http://localhost:8080/projects/<project_id>
```

## Step 5: Prompt Handling

Loop indefinitely:

1. Call the `wait_for_prompt` tool with `project_id`. On the first call, omit `prompt_id`.
   On subsequent calls, pass the `prompt_id` from the previous result.

2. If the prompt only requires calling a single Softlight MCP tool (e.g. `generate_mock_revision`),
   call the tool **directly** — do not spawn a subagent. After the tool
   returns, mark the prompt as done and loop back to step 1:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```

3. Otherwise, dispatch the skill in a **background** subagent. You must instruct the subagent to
   mark the prompt as done when it is finished by running:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```
   Loop back to step 1 immediately — do not wait for the subagent.

## Step 6: Cleanup

Run the `stop-tunnel` skill and then the `stop-application` skill to kill background processes.
