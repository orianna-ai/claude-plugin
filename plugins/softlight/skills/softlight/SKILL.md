---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Run the following script. It will run forever. Share a summary of the stdout of the process every
minute to help the user understand what the agent is working on. Display a loading animation while the script is running so that the user knows the agent is still working. Include key results that
the agent produces while it is working, but do not print anything if nothing has changed since the
last time you checked.

```bash
python3 -m dispatch_prompts
```
