---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

If the user has already provided the following information in their prompt, confirm it back to them and proceed. Otherwise, confirm with the user:

- **What application** is being changed
- **What design problem** they want to solve

Do not proceed until the user has provided both. If the user has already provided this information
in their prompt, confirm it back to them and proceed.

Run the following script to setup the Softlight project. The script will output
`project_id=<project_id>` and `project_url=<project_url>`.

```bash
python3 -m setup_project
```

Open the `<project_url>` in the user's browser by running the following command.

```bash
${BROWSER:-open} "$PROJECT_URL" 2>/dev/null || xdg-open "$PROJECT_URL" 2>/dev/null || true
```

Run the following script in the background (it will run forever).

```bash
python3 -m dispatch_prompts --project-id <project_id>
```

Tell the user the designer agent is working in the background and that they can watch progress on
the canvas as explorations and prototypes appear.
