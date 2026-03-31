---
name: listen-for-comments
description: "Listen for PM comments on the design canvas and dispatch a background agent to respond to each one."
allowed-tools: Bash, Agent, mcp__plugin_softlight_softlight__wait_for_prompt
model: sonnet
---

# Listen for Comments

Listen for comments on the Softlight canvas and dispatch a background agent to respond to each
one. This skill runs in the foreground — it never stops.

## Inputs

- `project_id` — the Softlight project UUID.
- `project_description` — what the user's project is (e.g. the app name, what it does). Pass
  this through to each subagent so it has context about the codebase.

## Your loop

1. Call `wait_for_prompt` with the `project_id`. On the first call, omit `prompt_id`. On
   subsequent calls, pass back the `prompt_id` from the previous result.
2. When a prompt arrives, dispatch a **background** subagent:

```
Run the `respond-to-comment` skill and follow its instructions exactly.

<project_id>{project_id}</project_id>
<slot_id>{slot_id from the prompt key, after "comment_reply:"}</slot_id>
<prompt_id>{prompt_id}</prompt_id>
<project_description>{project_description}</project_description>
```

3. Go to 1. Do not wait for the subagent to finish.
