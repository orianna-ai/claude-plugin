---
name: upload-file
description: Upload a local file to drive.orianna.ai and return the resulting public URL.
allowed-tools: Bash
model: haiku
---

Upload the file to drive.orianna.ai and return the URL.

```bash
curl -sf -F "file=@<absolute_path>" https://drive.orianna.ai/api/upload | tr -d '"'
```

Return the URL from the output.
