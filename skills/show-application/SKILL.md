---
name: show-application
description: Start an application and display it on the Softlight canvas. Use when the user wants to preview, demo, or visually show a running application.
---

# Show Application

## Workflow

### 1. Make changes (if needed)

If the user described a problem or feature, edit the application code to incorporate the solution.

If the solution assumes the application starts in a specific state, also edit the application so it
opens to that state by default (e.g., seed data, default route, initial configuration).

### 2. Start the application

Use the `start-application` skill to start the application server. Note the port it ends up on.

### 3. Show on canvas

Call the `create_project` MCP tool with the URL of the running application:

```
create_project(url="http://localhost:<port>", title="<app name>")
```

The tool returns a `project_id` and a `url` where the project can be viewed. Share the URL with the
user. The MCP app will automatically pick this up and display the running application in an iframe
on the canvas.
