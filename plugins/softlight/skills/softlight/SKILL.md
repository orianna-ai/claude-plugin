---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Do **not** ask the user any questions up front. The voice intake page collects
the design context. Run the steps below in order.

## 1. Setup the project

If the user invoked the skill with an argument, they want to **resume** that
project. Pass the argument through verbatim. The script accepts a project
ID (`b4f525d9-6858-4dcf-927e-5876b408da43`) or a project URL
(`https://softlight.orianna.ai/projects/b4f525d9-6858-4dcf-927e-5876b408da43`).

```bash
python3 -m setup_project '<project_id_or_url>'
```

If the user invoked the skill with no argument, create a new project:

```bash
python3 -m setup_project
```

Both invocations output a `<project_id>` and `<redirect_url>`. Open the
`<redirect_url>` in the user's browser:

```bash
${BROWSER:-open} '<redirect_url>' 2>/dev/null || xdg-open '<redirect_url>' 2>/dev/null || true
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
