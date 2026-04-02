---
name: softlight
description: Create a Softlight project, populate it with design work, and handle user interaction.
---

# Input

## `<port>`

Port that your application is running on.

## `<problem_statement>`

Description of the design problem you are trying to solve in your application.

# Steps

1. Call the `create_project` tool. Share the `project_url` and remember the `project_id`.

2. Call the `generate_mock_revision` tool in a **background** sub-agent.

3. Do the following indefinitely.

  a. Call the `wait_for_prompt` tool with the `project_id` from step 1 and `prompt_id` from the last
     time you called the tool.

  b. Handle the prompt in a **background** subagent. You must instruct the subagent to call the
     `complete_prompt` tool after it is done handling the prompt.

  c. Loop back to step 3a immediately. Never wait for the subagent to complete.
