---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Do **not** ask the user any questions up front. The voice intake page collects
the design context. Run the steps below in order.

## 1. Open the voice intake page

Run this script — it generates a project id and prints the intake URL.

```bash
python3 -m start_intake
```

It outputs `project_id=<project_id>` and `intake_url=<intake_url>`. Open the
intake URL in the user's browser:

```bash
${BROWSER:-open} "$INTAKE_URL" 2>/dev/null || xdg-open "$INTAKE_URL" 2>/dev/null || true
```

Then tell the user, in one short sentence: "Opened the intake — talk through
the problem in the browser, then click *Start designing* when you're done."
Do not ask follow-up questions; let the conversation happen in the browser.

## 2. Wait for the brief

Block on this script. It polls the backend and returns the conversation
transcript as markdown once the user clicks *Start designing*.

```bash
python3 -m wait_for_brief --project-id <project_id>
```

Read its stdout — that is the full intake brief. Treat it as the equivalent
of what the user would have typed at the prompt in the old flow: it describes
the application being changed, the design problem, and any constraints they
surfaced.

## 3. Set up the project

Pick a short (3-5 word) title that summarizes the design problem from the
brief. Then run:

```bash
python3 -m setup_project --project-id <project_id> --title "<title>"
```

It prints `project_url=<project_url>`. Do **not** open this URL — the user is
already on the canvas; the browser navigated there when they clicked *Start
designing*.

## 4. Dispatch the designer

Run in the background (it runs forever):

```bash
python3 -m dispatch_prompts --project-id <project_id>
```

Tell the user the designer agent is working in the background and that
explorations and prototypes will appear on the canvas as they're generated.
