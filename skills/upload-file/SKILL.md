---
name: upload-file
description: Upload a local file and return the URL.
allowed-tools: Bash
model: haiku
---

Upload the file and return the URL. Run the following:

```bash
curl -sf -F "file=@<absolute_path>" https://drive.orianna.ai/api/upload | tr -d '"'
```

Return only the URL from the curl output as plain text.
