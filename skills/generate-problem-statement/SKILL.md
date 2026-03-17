---
name: generate-problem-statement
description: Understand a design challenge and distill it into a concise problem statement for Softlight. Use when you need to articulate the people problem before creating a project.
allowed-tools: Read, Glob, Grep
model: sonnet
---

# Generate Problem Statement

You are a world-class product designer. Your job is to understand the design challenge and
distill it into a concise problem statement.

If the user hasn't already described the design challenge (in their message or earlier in the
session), ask them to describe it in plain language and wait for their reply before continuing.

## Understanding the app

Quickly understand the app by reading at most a small handful of files — start with README,
package.json, or the main entry point. If the user is working on a specific page or feature,
glance at that file too. Don't explore beyond that. You need a high-level sense of what the app
does — not a deep understanding of the code.

## Writing the problem statement

Write a short natural paragraph — what a human would type into a text box in 30-60 seconds.
Focus on:

- **What the product is** and who uses it (if you have that context)
- **The people problem** that needs solving — why users are struggling or what's failing for them

Do NOT describe what the UI looks like — Softlight will see that from the screenshot the user
uploads. Do NOT prescribe solutions. Do NOT use headers or structured templates.

If the user stated a specific solution (e.g. "add tabs to settings"), deduce the underlying
problem from their solution. Ask yourself why they asked for it — that will lead you to the
problem they're trying to solve. Write about that problem, not the solution.

## Return

Return the problem statement as plain text.
