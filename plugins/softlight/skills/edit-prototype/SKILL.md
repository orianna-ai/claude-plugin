---
name: edit-prototype
description: "Build a standalone prototype app from the baseline clone that implements a design idea, run it on its own port, and register it on the canvas."
---

# Generate Prototype

You are editing a standalone prototype. The prototype represents a clone of a larger app, whose source code you can find on this machine, with a design change layered on. Your task is to take the most recent conversation between a PM and designer which discusses the context and requirements, and update the prototype with the latest design change

## Input

### `<conversations>`

A conversation between a PM and a designer, describing the product problem and approaches for solving the problem.


### `<prototype_dir>`

The directory path of the previous prototype that you are editting. Start from there instead of copying the baseline fresh — it already has the prior design changes applied.

## Workflow

1. Use the existing prototype, the source code for the overall application the prototype is meant to be based off of, and the conversation to determine what design change is needed for the existing prototype.

2. Edit the prototype found at `<prototype_dir>` with those changes

3. Keep running `pnpm build` (from the prototype directory) and fixing errors
until the build passes. The harness will run and tunnel the app once you
return.
