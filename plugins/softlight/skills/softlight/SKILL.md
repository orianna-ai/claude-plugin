---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Run the following script and monitor its standard output. It will run forever. Share a summary of
the stdout of the process every 10 seconds to help the user understand what the agent is working on.
Include key results that the agent produces while it is working, but do not print anything if
nothing has changed since the last time you checked its progress.

```bash
python3 -m dispatch_prompts
```
