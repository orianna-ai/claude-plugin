---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Do **not** ask the user any questions up front. The voice intake page collects
the design context. Run the steps below in order.

## 1. Open the voice intake page

Run this script — it generates a `<project_id>` and prints the `<intake_url>`.

```bash
python3 -m setup_project
```

Open the `<intake_url>` in the user's browser:

```bash
${BROWSER:-open} '<intake_url>' 2>/dev/null || xdg-open '<intake_url>' 2>/dev/null || true
```

Then tell the user, in one short sentence: "Opened the intake — talk through
the problem in the browser, then click *Start designing* when you're done."
Do not ask follow-up questions; let the conversation happen in the browser.

## 2. Run the designer agent

Run in the background (it runs forever):

```bash
python3 -m run_agent --project-id '<project_id>'
```

Tell the user the designer agent is working in the background and that
explorations and prototypes will appear on the canvas as they're generated.
