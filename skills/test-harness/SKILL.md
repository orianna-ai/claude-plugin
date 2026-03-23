---
name: test-harness
description: Replay an events file against a local Softlight instance. Starts tunnels, posts events, and returns the project URL.
---

# Run Test Harness

Replay a recorded events file end-to-end against a local Softlight instance.

## Input

The user provides:

- **file name** — name of a file in `events/` without the `.json` extension
- **port** — local port where the target application is already running
- **starting phase** — which `run-orchestrator` phase to begin from after setup (e.g. Phase 3,
  Phase 3b, Phase 4). This is required — ask the user if they don't specify it.

## Step 1: Extract Tunnel IDs

Run the extraction script to find all tunnel IDs referenced by the events file:

```bash
python3 ./extract_tunnel_ids.py <file_name>
```

The script prints a JSON array of unique tunnel ID strings. Parse this output — you will need it
for the next step.

## Step 2: Start Tunnels

For **each tunnel ID** from Step 1, run the `start-tunnel` skill with the user-provided port and
that tunnel ID.

If there are multiple tunnel IDs, launch them **in parallel**. Wait for all tunnels to be live
before proceeding.

## Step 3: Setup Project

Post the events to the local MCP server:

```bash
python3 ./setup_project.py <file_name>
```

The script prints the `project_id`.

## Step 4: Output

Print the project URL:

```
http://localhost:8080/projects/<project_id>
```

## Step 5: Run Orchestrator Pipeline

Read the `run-orchestrator` skill and execute starting from the phase the user specified. Steps 1–4
above replace the orchestrator's Phase 1 (Setup) and Phase 2 (Project Creation) — the project
already exists with the `project_id` from Step 3.

Enter the orchestrator at the user's starting phase and continue the Phase 3 → Phase 4 → Phase 5
loop from there.

## Step 6: Cleanup

Run the `stop-tunnel` skill to kill background tunnel processes.
