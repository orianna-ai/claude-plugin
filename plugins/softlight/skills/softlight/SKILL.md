---
name: softlight
description: Create a Softlight project backed by a long-running agent.
---

If the user has already provided the following information in their prompt, confirm it back to them and proceed. Otherwise, confirm with the user:

- **What application** is being changed
- **What design problem** they want to solve

Do not proceed until the user has provided both. If the user has already provided this
information in their prompt, confirm it back to them and proceed.

Once you have both, run the following script in the background (it will run forever):

```bash
python3 -u -m dispatch_prompts
```

The Shell tool will return an `output_file` path when the command is backgrounded. Save that path.
Use the Read tool with `offset` set to -200 on the `output_file` in a loop to monitor progress.
The output is a stream of JSON lines — it will be noisy. Summarize key results and messages produced
by the agent. Do not say anything else — no filler messages like "Continuing to poll" or "No new
output". Continue reading in a loop indefinitely — do not stop or end your turn.
