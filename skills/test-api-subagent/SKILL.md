---
name: test-api-subagent
description: Test that a skill can run a Python script that calls the Anthropic API to make a filesystem change.
allowed-tools: Bash, Read
---

# Test API Subagent

Run a Python script that calls the Anthropic API directly (inheriting `ANTHROPIC_API_KEY` from
the environment) to make the "Find inspiration" CTA button on the `inspiration_public` homepage
bright red.

## Step 1: Run the script

Run `make_button_red.py` from this skill's directory, passing the workspace root:

```bash
python3 ./make_button_red.py /workspaces/orianna
```

The script installs its own dependencies if needed, gives Claude filesystem tools, and prompts it
to make the CTA button bright red. Claude explores the codebase and makes the change itself.

## Step 2: Verify

Read `server/inspiration_public/ui/components/LandingPage.css` and confirm the `.landing-page-cta`
class now uses a red color (e.g. `#FF0000`, `#EF0000`, `red`, etc.) instead of the original brown
(`#453321`). Report the result to the user.
