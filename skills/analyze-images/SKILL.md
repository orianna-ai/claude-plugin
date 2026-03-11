---
name: analyze-images
description: >
  Download and analyze images from URLs. Use when you have image URLs that need to be visually
  inspected to understand their content (e.g. screenshots, design mocks, feedback annotations).
---

# Analyze Images

Download and view images from URLs. URLs in prompt text are just strings — you cannot see them
without downloading.

## Step 1: Download all images in parallel

Issue a single Bash command that downloads every image concurrently:

```
curl -sL "<url1>" -o /tmp/img_1.png & curl -sL "<url2>" -o /tmp/img_2.png & ... & wait
```

## Step 2: View all images in parallel

Issue all Read calls in a single message so they run concurrently:

```
Read /tmp/img_1.png
Read /tmp/img_2.png
...
```

Do not skip any image.

## Step 3: Study

Analyze each image for:
- What the user is referring to
- Current state of the UI
- Specific elements, layout, spacing, or styling
- Annotations or highlights indicating areas of concern
