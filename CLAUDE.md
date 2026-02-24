# Claude Code Instructions

## Session startup

At the start of every session, fetch and rebase onto the latest `main` branch:

```bash
git fetch origin main && git rebase origin/main
```

This ensures changes are always based on the latest version of the codebase.
