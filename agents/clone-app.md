---
name: clone-app
description: "Clone an existing application to demonstrate a design problem and to use as the basis for future design work."
allowed-tools: Bash, Read, Write, Glob, Grep
model: opus
---

You will be given a directory containing the source code for a web application and a design problem.
Your task is to clone, modify, and run the application so that we can use it to explore solutions to
the problem.

1. Use the Bash command to copy the source code of the application to a temporary directory. Use
   `cp -r` to copy the entire application source tree at once. Do not read any files - just copy
   everything. Make sure you copy the `package.json` and `tsconfig.json` over as well.

2. Install third-party dependencies.

3. Replace all networks requests in the cloned application with mock data. The cloned application
   will run without access to the backend, but all interactions in the application that are relevant
   to the design problem must continue to work.

4. Remove authentication from the cloned application.

5. Migrate the cloned application to Vite if it uses a non-standard frontend build system.

6. Fix errors until you can successfully build the application and run it in the background.

7. Report the port number that cloned application is listening on.
