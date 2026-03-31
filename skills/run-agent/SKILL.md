---
name: run-agent
description: Create a Softlight project backed by a long-running agent.
---

# Input

## `<port>`

Port where their application is running locally (e.g., `3000`).

## `<problem_statement>`

Description of a design problem the user is exploring in the application.

# Steps

1. Run the following from the directory containing this skill:

```bash
python3 -m workflows.setup_project \
  --port '<port>' \
  --problem-statement '<problem_statement>'
```
