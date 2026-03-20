---
name: screenshot-prototypes
description: Open each prototype in the browser, understand the proposed design changes, and capture screenshots that show what changed so evaluators can review without touching the browser.
allowed-tools: Bash, Read, Glob, Grep, mcp__plugin_softlight_softlight__get_project, browser
model: sonnet
---

# Screenshot Prototypes

Your job is to capture screenshots that help evaluators understand what each prototype is
proposing. You are not exploring aimlessly — you are reading the design spec for each prototype,
understanding what it changed, and then capturing the specific screens and states that show
those changes clearly.

## Inputs

You will receive:

- **`project_id`** — the Softlight project containing the prototypes

## Step 1: Understand what was designed

Call `get_project` with the `project_id`. From the response:

1. Read the **problem statement** — this is the design challenge the prototypes are responding to.
2. Find all slots in the **latest revision**. Each prototype (iframe slot) has a text caption
   slot nearby that describes the design change — the spec the content script was built from.
   Read these captions to understand what each prototype is trying to do.
3. Note the **slot IDs** of every iframe slot. For each, build the prototype URL:

```
http://localhost:8080/api/tunnel/{element.tunnel_id}/?content_script_url={element.content_script.url}
```

4. Note the **`tunnel_id`** from any iframe slot — all prototypes share the same tunnel. Build
   the baseline URL (the app without any content script):

```
http://localhost:8080/api/tunnel/{element.tunnel_id}/
```

You now know what each prototype proposes. Use that knowledge to decide what to screenshot.

## Step 2: Capture the baseline

Before screenshotting any prototype, capture the **baseline** — the app as it looks today in
production, without any content script applied.

Open the baseline URL in the browser. Take 1-2 screenshots that show the current state of the
screen the prototypes are modifying. These give evaluators a reference point to compare against.

Save baseline screenshots to `/tmp/eval_screenshots/`:

```
/tmp/eval_screenshots/baseline_1.png
/tmp/eval_screenshots/baseline_2.png
```

## Step 3: Capture each prototype

For each prototype, open its URL in the **browser**:

1. Take a screenshot of the initial view — this is usually where the main design change is visible.
2. Based on the design spec you read, navigate to the specific screens or trigger the specific
   interactions that show the proposed change. For example:
   - If the spec says "redesigned the hero section and added a new pricing table below the fold,"
     screenshot the hero and scroll down to capture the pricing table.
   - If the spec says "new empty state when the user has no projects," the landing view already
     shows it — one screenshot may be enough.
   - If the spec says "added a multi-step onboarding flow," click through each step and
     screenshot each one.
3. Capture only what matters. One good screenshot of the key change is better than five
   screenshots of unrelated parts of the page.

Save screenshots to `/tmp/eval_screenshots/`:

```
/tmp/eval_screenshots/{slot_id}_1.png
/tmp/eval_screenshots/{slot_id}_2.png
...
```

Create the directory first:

```bash
mkdir -p /tmp/eval_screenshots
```

## Step 4: Write the manifest

Write a JSON manifest to `/tmp/eval_screenshots/manifest.json`:

```json
{
  "baseline": {
    "screenshots": [
      {"path": "/tmp/eval_screenshots/baseline_1.png", "description": "Current production homepage"}
    ]
  },
  "slots": {
    "<slot_id>": {
      "design_summary": "Brief description of what this prototype proposes",
      "screenshots": [
        {"path": "/tmp/eval_screenshots/<slot_id>_1.png", "description": "Redesigned hero with new headline and CTA"},
        {"path": "/tmp/eval_screenshots/<slot_id>_2.png", "description": "Pricing table below the fold"}
      ]
    }
  }
}
```

- `baseline` — screenshots of the unmodified app, the reference point for all comparisons
- Each slot entry has:
  - `design_summary` — what this prototype is proposing (from the caption/spec you read)
  - `screenshots` — each with a `path` and `description` of what it shows

## Step 5: Return

Return the path to the manifest file: `/tmp/eval_screenshots/manifest.json`
