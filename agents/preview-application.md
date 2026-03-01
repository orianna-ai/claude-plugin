---
name: preview-application
description: Build, run, and preview an application via a Softlight tunnel. Use when the user wants to see their app running through the tunnel proxy.
model: sonnet
skills:
  - softlight:start-application
  - softlight:create-tunnel
memory: user
---

# Preview Application

Your task is to build, serve, and expose the application through a Softlight tunnel so the user
can preview it. This agent is designed to run in the background — launch it early so the app is
ready by the time prototypes are needed.

## Workflow

### Phase 1: Start the app

Use the `start-application` skill to figure out how to serve the application on a free port.
Note the port and the app PID.

### Phase 2: Create the tunnel

Use the `create-tunnel` skill with the port from phase 1 to expose the app through a Softlight
tunnel. Note the tunnel URL and frpc PID.

### Phase 3: Return

Pass through everything from both skills:
- The **tunnel URL** where the app is accessible
- The **local URL** (`http://localhost:<port>/`)
- The app PID and frpc PID (so `stop-application` can tear them down later)
- All project info from start-application (framework, source location, entry point, key configs)
