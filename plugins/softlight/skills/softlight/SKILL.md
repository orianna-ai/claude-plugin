---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

# Input

## `<port>`

Port where their application is running locally (e.g., `3000`).

# Steps

1. Clarify the design problem the user is trying to solve. Quickly explore the codebase to
   understand the business context, user journey, and product domain and use this information to
   write a short `<problem_statement>` that you will subsequently use as the basis of your design
   work. Only explore the parts of the codebase that are relevant to the running application. Feel
   free to ask questions if you are not sure what application is running or where its source code is
   located in the codebase.

2. Run the following from the directory containing this skill.

```bash
python3 -m workflows.setup_project \
  --port '<port>' \
  --problem-statement '<problem_statement>'
```

3. Run the following from the directory containing this skill. It will run forever.

```bash
python3 -m workflows.dispatch_workflows
```
