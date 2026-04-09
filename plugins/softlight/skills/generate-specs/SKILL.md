---
name: generate-specs
description: Generate specifications for solutions to a design problem.
---

# Input

## `<workspace>`

Absolute path to the application source tree. All references to "the application" in this skill
mean the code rooted at `<app_workspace>`. Scope all file exploration, reads, and reasoning to
files under this directory — do not read files outside it.

## `<problem>`

Description of a design problem the user is exploring in the application.

# Output

Your task is to generate a list of specs.

Each spec represents a specific change to the application that addresses the stated `<problem>`.
