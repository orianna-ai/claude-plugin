---
name: upload-file
description: Upload a local file to drive.orianna.ai and return the resulting public URL.
---

# Upload File

## Input

A local file path to upload.

## Steps

### 1. Resolve the file path

Expand any relative path to an absolute path. Verify the file exists.

### 2. Upload

```bash
curl -s -F "file=@<absolute_path>" https://drive.orianna.ai/api/upload | tr -d '"'
```

### 3. Report

Return the URL.
