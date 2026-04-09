---
name: clone-app
description: >
  Clone elements of an existing application to demonstrate a design problem and to use as the basis
  for future design work.
---

# Input

## `<path>`

Directory in which to generate the clone.

## `<problem>`

Description of a design problem the user is exploring in the application.

# Output

Your task is to generate a clone of the application described by the `<problem>` under the `<path>`
directory.

- The following command has already been run in `<path>` to setup the application scaffolding.

```bash
npm create vite@latest -- --template react-ts --no-interactive .
```

- Run the following command at the end to validate your changes. Fix errors but ignore warnings.

```bash
cd <path> && npm install --no-audit --no-fund --no-progress --prefer-offline && npm run build
```

- The clone should contain only the subset of features that are required to demonstrate the
  `<problem>` and evaluate proposed solutions to it. Work in two phases. First, **discover**: use
  `ls`, `grep`, and `find` to build a list of every file you will need to read. Second, **ingest**:
  read every file on that list in a single tool call message containing parallel Read blocks. Avoid
  reading files one at a time.

- Pin each dependency to the same version as the source project's package.json, but include only
  packages the cloned code actually imports.

- Replace API calls with hard-coded mock data. Keep mock data minimal: 3–8 rows per entity is enough
  to demonstrate the problem. Do not build mock data generators or spread mock data across many
  files unless the problem explicitly requires scale.

- The clone must be a React app that is written in TypeScript and bundled with Vite.

- The clone will not be committed and will never be read by anyone besides you. Do not generate
  `README.md` and `.gitignore` files and avoid generating comments.
