---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

If the user has already provided the following information in their prompt, confirm it back to them and proceed. Otherwise, confirm with the user:

- **What application** is being changed
- **What design problem** they want to solve

Do not proceed until the user has provided both. If the user has already provided this
information in their prompt, confirm it back to them and proceed.

Once you have both, run the following script in the foreground. It will run forever. Share a summary
of the stdout of the process every minute to help the user understand what the agent is working on.
Do not use the Monitor tool - the output is too noisy. Include key results that the agent produces
while it is working, but do not print anything if nothing has changed since the last time you
checked.

```bash
python3 -m dispatch_prompts
```
