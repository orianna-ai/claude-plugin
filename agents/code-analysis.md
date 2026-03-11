---
name: code-analysis
description: "Analyze a web application's source code to extract everything needed for content scripts and running the app — selectors, component structure, design tokens, API shapes, routing, and start commands."
memory: local
---

# Code Analysis

Produce a structured analysis of a web application so downstream agents can write content scripts
and start the application without re-reading source code. Run once per application — cached in
memory.

## Step 0: Find the app root and check memory

The **application root** is the directory that contains the application's entry point. To find it,
begin at the repository root. If the repository root has a `package.json` file with a `dev` /
`start` script it is likely to be the application root. If it only has workspace configuration
(Turborepo, Nx, Lerna, Bazel), look for the application root within sub-folders (e.g., `apps/`, 
`packages/`). Pick the application root that is most relevant to the user's task.

Once you have determined the application root, check memory. Memory mirrors the applications's 
location relative to the working directory:

| App root | Memory path |
|----------|-------------|
| `./` | `analysis.md` |
| `./frontend` | `frontend/analysis.md` |
| `./apps/web` | `apps/web/analysis.md` |

If a cached analysis exists and the application has not changed substantially, return it. Otherwise 
continue.

## Step 1: Read source

Start at the application entry point. Follow imports into pages and components. Focus on extracting 
the information needed for the output sections below.

## Step 2: Save and return

Save the analysis to the memory path from Step 0, then return it.

The analysis must contain these sections:

---

### How to start it

Everything `start-application` needs to run the app:

```
Install: npm install
Dev: PORT=<port> npm run dev
Port: PORT env var
```

### How to render each page

For each key page, a recipe that a content script can follow mechanically:

```
### /dashboard (default route)
Route: history.pushState(null, "", "/dashboard") + dispatch popstate
Auth: localStorage.setItem("token", "eyJhbG...") — checked by useAuth() in src/hooks/auth.ts
State: needs { user: {...}, isLoaded: true } in AuthContext
Fetch mocks:
  GET /api/user → { id: "u1", name: "Jane Chen", email: "jane@acme.co", role: "admin" }
  GET /api/stats → { total_users: 1284, revenue: 48520, growth: 12.5 }
  GET /api/activity → [{ id: "a1", type: "signup", message: "New user registered", ts: "2024-03-10T14:30:00Z" }, ...]
Rendering gates: AuthProvider.isAuthenticated must be true, StatsPage checks data !== null
```

Include full realistic response bodies — not just shapes. The content script agent should be
able to copy these directly into a fetch mock.

### How to style injected elements

Exact values a content script needs to match the app's visual language:

```
Colors:
  --bg-primary: #1a1a2e
  --bg-secondary: #16213e
  --text-primary: #e0e0e0
  --text-secondary: #a0a0a0
  --accent: #4fc3f7
  --border: #2a2a3e

Typography:
  Font: Inter, system-ui, sans-serif
  Base size: 14px
  Weights: 400 (body), 500 (labels), 700 (headings)

Spacing: 8px grid
Border radius: 6px (cards), 4px (inputs), 50% (avatars)
```

Use the actual CSS custom properties if the app defines them. Otherwise extract values from
stylesheets or theme files.

### How to target existing elements

Selectors grouped by page region, so content scripts know what to grab:

```
Layout:
  Header: .app-header, [data-testid="header"]
  Sidebar: .sidebar-nav, nav.sidebar
  Main: .main-content, main

Dashboard:
  Stats grid: .stats-grid > .stat-card
  Activity list: .activity-list > .activity-row
  Chart: .chart-container > canvas
```

### Where to find source code

Every file read, annotated so downstream agents know what's in each without opening it:

```
src/App.tsx — root component, wraps AuthProvider + Router
src/pages/Dashboard.tsx — stats grid, activity list, chart
src/components/Sidebar.tsx — nav links, user avatar, collapse toggle
src/theme.ts — CSS custom properties, color palette, spacing scale
src/api/client.ts — fetch wrapper, base URL, auth header injection
src/routes.tsx — route definitions, lazy imports, auth guards
src/hooks/auth.ts — useAuth() hook, checks localStorage "token"
```

---

Every value must come from the source. Use exact hex codes, exact class names, exact endpoint
paths, exact response fields. Never generalize.
