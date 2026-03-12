---
name: create-attachment
description: Upload a local file to drive.orianna.ai and return an attachment object with the file name and public URL.
allowed-tools: Bash
model: haiku
---

Upload the file to drive.orianna.ai and return an attachment object.

```bash
curl -sf -F "file=@<absolute_path>" https://drive.orianna.ai/api/upload | tr -d '"'
```

Extract the file name from the absolute path (the last path component) and the URL from the curl output.

Return the result as an attachment object with this structure:

```json
{
  "name": "<file name>",
  "url": "<url from curl output>"
}
```
