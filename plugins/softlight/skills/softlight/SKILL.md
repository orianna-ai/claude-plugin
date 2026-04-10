---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

1. Use the `/clarify-problem` skill to identify the `<problem>` the user is working on.

2. Run the following from the directory containing this skill. This can take up to 10 minutes.

```bash
python3 -m workflows.setup <problem>
```

3. Share the `app_url`, `tunnel_url`, and `project_url` with the user as clickable links.

4. Run the following from the directory containing this skill. It will run forever.

```bash
python3 -m workflows.dispatch_workflows
```
