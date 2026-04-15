---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

Run the following script. It will run forever. Share a summary of the stdout of the process every
30 seconds to help the user understand what the agent is working on. Include key results that the
agent produces while it is working, but do not print if nothing has changed.

```bash
python3 -m dispatch_prompts
```
