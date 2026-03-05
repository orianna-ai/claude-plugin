---
name: download-images
description: >
  Download and view images from URLs. Use when you have image URLs that need to be visually
  inspected to understand their content (e.g. screenshots, design mocks, feedback annotations).
---

# Download and View Images

Use this skill when you have image URLs and need to visually inspect them. URLs in prompt text
are just strings — you cannot see the images without downloading them.

## Workflow

For each image URL, download it to a temp file and then view it:

```
curl -sL "<url>" -o /tmp/img_<N>.png
```

Then use the **Read** tool on the downloaded file (e.g. `Read /tmp/img_1.png`). The Read
tool displays images visually so you can inspect them.

**Do this for every image URL — do not skip any.**

Study them carefully. These images are your ground truth for understanding:
- What the user is referring to
- The current state of the UI
- Specific elements, layout, spacing, or styling being discussed
- Annotations or highlights indicating areas of concern
