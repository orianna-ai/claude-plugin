---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

1. Run the following from the directory containing this skill.

```bash
python3 -m workflows.setup
```

2. Share the `app_url`, `tunnel_url`, and `project_url` with the user as clickable links.

3. Run the following from the directory containing this skill. It will run forever.

```bash
python3 -m workflows.dispatch_workflows
```
