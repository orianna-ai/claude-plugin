---
name: design-session
description: >
  Run a Softlight design session: discover the problem, generate 5 design ideas with
  placeholder loading states, create prototypes in parallel, and handle ongoing prompts.
model: sonnet
---

# Design Session

Orchestrate a Softlight design session. You are responsible for discovering the user's problem,
generating design ideas, placing them on the canvas, and handling ongoing prompts. Do not stop or
ask clarifying questions beyond Phase 1. You MUST run through all phases in order.

## Phase 1: Problem Discovery

Determine what the user wants to work on and which application it targets. Check the user's input:

- If they've already described **both** the problem and the app, proceed immediately to Phase 2.
- If either is missing, ask **one** concise question to fill the gap. Do not belabor — a single
  sentence from the user is enough.

Produce two things before moving on:
1. A **problem statement** — 1-2 sentences describing the people problem (not the solution).
2. The **target app** — which application to design for.

## Phase 2: Idea Generation

Generate **5 distinct design directions** that address the problem statement. Think like a
world-class product designer — each idea should be a meaningfully different approach to solving the
problem, not minor variations.

For each idea, produce:
- **`title`** — A short display label (3-8 words)
- **`change_description`** — A detailed description of the design change, specific enough that an
  engineer could implement it. Describe the UX outcome, layout changes, and key interactions.

## Phase 3: Start the Baseline App and Create the Project

### 3a. Capture git info

```bash
GIT_COMMIT=$(git rev-parse HEAD)
```

### 3b. Create app and then run `start-tunnel`

Run the baseline app on a free port, then run the `start-tunnel` skill to create a tunnel. Save the `TUNNEL_ID` from the tunnel output.

### 3c. Create the project

Call the `create_project` tool with `problem_statement`, `git_commit`, `tunnel_id`. Share the `project_url` with the user (e.g., `[View in Softlight →](<project_url>)`) and remember the `project_id`.

### 3d. Create placeholder slots on the canvas

Call the `create_loading_revision` tool with the `project_id` and the 5 ideas from Phase 2. This
will:

- Create a new revision with 5 placeholder slots (loading skeletons)
- Add a text caption below each placeholder with the idea's description
- Fire prompt events for each idea (shows loading spinners in the UI)

The tool returns `slot_ids` and `prompt_ids` for tracking.

## Phase 4: Prepare Agent Inputs

Merge each idea's `title` and `change_description` (from Phase 2) with its `slot_id` and
`prompt_id` (from Phase 3d) into a list of 5 variant records.

### 4a. Assign free ports

Find 5 free ports starting from 50000:

```bash
ss -tlnp | grep -oP ':\K[0-9]+' | sort -n > /tmp/_used_ports.txt
```

For each idea, find the next free port:

```bash
PORT_N=50000; while grep -qx "$PORT_N" /tmp/_used_ports.txt; do PORT_N=$((PORT_N+1)); done
echo "$PORT_N" >> /tmp/_used_ports.txt
```

Save the port for each idea.

## Phase 5: Launch Worktree Agents

Launch all 5 agents as **background** agents, each with **worktree isolation**. Launch them
**one at a time** — send one Agent tool call, wait for it to confirm it is running in the
background, then send the next. Do NOT send all 5 in a single message (simultaneous launches
cause resource contention and failures). Once launched, they all run concurrently.

For each variant, use the Agent tool with these parameters:

- `description`: `"Variant {i} prototype"`
- `model`: `"sonnet"`
- `isolation`: `"worktree"`
- `run_in_background`: `true`
- `prompt`: Use the following prompt, substituting in the values for this variant:

```
Run the `generate-app` skill with these inputs:

- title: {title}
- variant_description: {variant_description}
- port: {port}
- project_id: {project_id}
- slot_id: {slot_id}
- prompt_id: {prompt_id}
```

Each agent will read the `generate-app` skill instructions and follow them autonomously.

### Proceed immediately

Do NOT wait for the agents to finish. Each agent independently updates its slot and marks its
prompt done via curl. Once all 5 are launched, proceed to Phase 6 right away.

## Phase 6: Prompt Handling

Loop indefinitely:

1. Call the `wait_for_prompt` tool with `project_id`. Do NOT pass a `prompt_id` on the first call —
   omit it so the cursor starts from the current position (after the initial 5 prompts handled by
   generate-app). On subsequent iterations, pass the `prompt_id` from the previous call.

2. If the returned prompt has `key` equal to `"cancel"`, the user clicked **Stop** in the UI.
   **Break out of the loop immediately** and proceed to Phase 7 (Cleanup). Do not dispatch any
   further subagents.

3. If the prompt only requires calling a single Softlight MCP tool (e.g. `plan_prototype_revision`),
   call the tool **directly** — do not spawn a subagent. After the tool returns, call the
   `complete_prompt` tool to mark it as done, then loop back to step 1.

4. Otherwise, dispatch the skill in a **background** subagent. You must instruct the subagent to
   mark the prompt as done when it is finished by calling:
   ```
   curl -s -X POST "http://localhost:8080/api/projects/<project_id>/events" \
     -H "Content-Type: application/json" \
     -d '[{"type":"prompt_completed","prompt_id":"<prompt_id>"}]'
   ```
   Loop back to step 1 immediately — do not wait for the subagent.

## Phase 7: Cleanup

Run the `stop-tunnel` skill and then the `stop-application` skill to kill background processes.
