---
name: screenshot-iframes
description: Open each prototype in the browser, understand the proposed design changes, and capture screenshots that show what changed so evaluators can review without touching the browser.
allowed-tools: Bash, Read, Glob, Grep, mcp__plugin_softlight_softlight__get_project, mcp__plugin_softlight_softlight__set_iframe_screenshots, browser
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
2. Find all slots in the **latest revision**. Each iframe element has a `spec_url` — download
   it with `curl` to get a JSON object with a `spec` field describing the intended design
   change represented in that prototype. Read these specs to understand what each prototype
   is trying to do.
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

Before screenshotting any prototype, capture the **baseline** — the app without any content
script applied. Open the baseline URL in the browser, navigate to the areas the prototypes
modify, and screenshot them. Evaluators compare prototypes against these baseline screenshots.

Save to `/tmp/eval_screenshots/baseline_1.png`, `baseline_2.png`, etc.

## Step 3: Capture each prototype

For each prototype, open its URL in the browser. You already know what it changed from reading
the spec — navigate to where those changes are and capture screenshots of every modified
surface. Evaluators cannot open the browser; if you don't capture it, they can't review it.

Save to `/tmp/eval_screenshots/{slot_id}_1.png`, `{slot_id}_2.png`, etc.

```bash
mkdir -p /tmp/eval_screenshots
```

## Step 4: Upload and attach screenshots

For each prototype slot, upload its screenshots to drive and attach them to the iframe element.

1. Upload each screenshot file to drive:

```bash
curl -sF 'file=@/tmp/eval_screenshots/<slot_id>_1.png' https://drive.orianna.ai/api/v2/upload
```

The response body is the drive URL of the uploaded file.

2. After uploading all screenshots for a slot, call `set_iframe_screenshots` with:
   - `project_id`
   - `slot_id`
   - `screenshot_urls` — the list of drive URLs from step 1

Repeat for every iframe slot.

Baseline screenshots do not need to be uploaded — they are already stored on the project from
when it was created.

## Step 5: Return

Confirm that screenshots were uploaded and attached to all iframe slots.
