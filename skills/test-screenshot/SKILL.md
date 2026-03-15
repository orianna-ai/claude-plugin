---
name: test-screenshot
description: Test screenshot capture reliability by running 3 parallel pipelines and analyzing whether each screenshot correctly shows the intended application state.
model: sonnet
---

# Test Screenshot Capture

Test the screenshot capture pipeline for reliability. Run 3 independent pipelines in parallel —
each generates its own content script, problem statement, and tunnel, then creates a project whose
screenshot is analyzed for correctness.

The application must already be running on a port specified in the user's input. Do not start the
application — it is already running.

Do not stop or ask the user clarifying questions for any reason. Run through all phases and each
phase must complete before going to the next one.

## Phase 1: Parallel Pipelines

Spawn **3 background subagents** running **in parallel**. Each subagent performs the following
steps **in sequence**:

### Step 1: Content Script

Run the `generate-content-script` skill. Pass it the user's input so it knows which screen and
state to target. Save the returned content script URL.

### Step 2: Problem Statement

Run the `generate-problem-statement` skill. Pass it the user's input. Save the returned problem
statement text.

### Step 3: Tunnel

Run the `start-tunnel` skill with the port from the user's input. The application is already
running on this port — do not start it. Save the returned tunnel URL and frpc PID.

### Step 4: Create Project

Call the `create_project` tool with:
- `content_script_url`: from Step 1
- `problem_statement`: from Step 2
- `tunnel_url`: from Step 3

Save the `project_id` and `project_url`.

Each subagent must return all of: content script URL, tunnel URL, frpc PID, project ID, and
project URL.

All 3 subagents must complete before proceeding to Phase 2.

## Phase 2: Screenshot Analysis

For each of the 3 projects from Phase 1:

1. Get the screenshot URL. The screenshot is stored as an attachment on the project's problem.
   Fetch the project data via the REST API:

   ```bash
   curl -s http://localhost:8080/projects/$PROJECT_ID
   ```

   Parse the JSON response. The screenshot URL is in `problem.attachments[0].url`.

2. Download the screenshot image:

   ```bash
   curl -sL "$SCREENSHOT_URL" -o /tmp/screenshot_$N.png
   ```

3. Read the downloaded screenshot image file to see what it captured.

4. Determine if the screenshot correctly shows the right screen and state for the design problem.
   A correct screenshot shows the target page with realistic data populated by the content
   script. An incorrect screenshot shows a login page, blank page, loading spinner, error state,
   wrong page, or default landing page.

5. If the screenshot is NOT correct, download the content script from its URL and read it.
   Analyze why it failed.

## Phase 3: Return Results

Return a structured summary for each of the 3 runs:

- **Content script URL**: the URL of the uploaded content script
- **Screenshot URL**: the URL of the captured screenshot
- **Screenshot correct**: YES or NO
- **Analysis**: if incorrect, explain what went wrong and why, referencing the content script
  code. If correct, briefly describe what the screenshot shows.

Include an overall summary: how many of the 3 runs produced a correct screenshot, and any
patterns in failures across the runs.

## Phase 4: Cleanup

Run the `stop-tunnel` skill for each of the 3 frpc PIDs to clean up tunnel processes.
