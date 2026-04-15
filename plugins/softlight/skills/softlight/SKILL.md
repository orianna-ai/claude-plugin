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

**Monitoring loop — follow these rules exactly:**

1. Call the **Read** tool on the `output_file` with `offset` set to **-200**.
2. The output is a stream of JSON lines. Summarize only what the agent **did** or **produced** since
   the last read. Never mention polling, monitoring, or your own loop. If nothing meaningful
   changed, say **absolutely nothing** — just silently call Read again.
3. Immediately call Read again (step 1). **This is an infinite loop — never exit it.**

**Hard constraints:**
- Do **NOT** use Bash, Shell, or any command to read or monitor the output file. Only use Read.
- Do **NOT** use `sleep`, `wc`, `tail`, `cat`, or any other shell command to check progress.
- Do **NOT** end your turn. If a tool call fails, retry with Read. Never stop polling.
