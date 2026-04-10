---
name: clone-app
description: "Clone an existing application to demonstrate a design problem"
---

Your task is to locate the directory containing the source code for the application related to the
`<problem>`, clone it to the `<path>`, and modify the cloned application so it can run without
access to its backend or any other third-party services and using standard frontend development
tools. Then, run the application in the background and return the pid of the process and the port
number the application is listening on.

1. Use the Bash command to copy the source code of the application to the `<path>`. Use `cp -r` to
   copy the entire application source tree at once. Do not read any files - just copy everything.
   Preserve the directory structure so that relative imports continue to resolve. Make sure you copy
   the `package.json` and `tsconfig.json` over as well.

2. Install third-party dependencies.

3. Replace all networks requests in the cloned application with mock data. The cloned application
   will run without access to the backend, but all interactions in the application that are relevant
   to the design problem must continue to work.

4. Remove authentication from the cloned application.

5. Migrate the cloned application to Vite if it uses a non-standard frontend build system.

6. Fix errors until you can successfully build the application and run it in the background.

7. Return the pid of the cloned application and the port number it is listening on.
