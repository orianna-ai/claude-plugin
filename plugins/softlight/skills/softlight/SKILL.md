---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

If the user has already provided the following information in their prompt, confirm it back to them and proceed. Otherwise, confirm with the user:

- **What application** is being changed
- **What design problem** they want to solve

Do not proceed until the user has provided both. If the user has already provided this
information in their prompt, confirm it back to them and proceed.

Once you have both, run the following script in the background (it will run forever).
Pass the design problem as a quoted argument:

```bash
python3 -u -m dispatch_prompts "DESIGN_PROBLEM"
```

The Shell tool will return an `output_file` path when the command is backgrounded. Read
the `output_file` with the Read tool (use `offset: -50`) until you see a line starting with
`PROJECT_URL=`. Extract the URL.

Once you have the URL:

1. Print the full project URL for the user.
2. Open it in the user's browser:
   ```bash
   ${BROWSER:-open} "$PROJECT_URL" 2>/dev/null || xdg-open "$PROJECT_URL" 2>/dev/null || true
   ```
3. Tell the user the designer agent is working in the background and they can watch
   progress on the canvas as explorations and prototypes appear.
