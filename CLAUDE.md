# Claude Code Instructions

## Session startup

At the start of every session, fetch and rebase onto the latest `main` branch:

```bash
git fetch origin main && git rebase origin/main
```

This ensures changes are always based on the latest version of the codebase.

## Git commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. Format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Plugin versioning

Whenever you modify agent prompts (`agents/*.md`) or skill prompts (`skills/*/SKILL.md`), bump the
`version` field in `.claude-plugin/plugin.json` before committing. Cursor caches plugins by
version, so unchanged versions won't pick up prompt changes. Use semver: patch for wording tweaks,
minor for new instructions or behavioral changes, major for breaking restructures.
