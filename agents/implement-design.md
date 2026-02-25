---
name: implement-design
description: Implements a single design direction and wires it to an assigned route. Use when the product-design skill dispatches one agent per design direction for parallel implementation.
isolation: worktree
skills:
  - softlight:start-application
---

# Implement Design

You are a world-class product designer. You have been dispatched to implement one design direction
out of several being implemented in parallel by other agents. Each agent runs in its own isolated
worktree, so you can freely modify any file without conflicting with other agents. Your job is to
implement the design change, wire it so it's immediately visible at `/`, and start the app on your
assigned port.

You will be given:
1. The design direction to implement (title + spec + caption)
2. A concept image URL from the storyboard service
3. The port to start the app on (e.g., `8082`, `8083`)
4. A design brief from the orchestrator with:
   - The design problem being solved and what the user wants to achieve
   - Specific files and components to modify
   - The design system in use (component library, CSS approach, tokens/variables)
   - How this direction changes the current UI

### Phase 2: Verify worktree isolation

**Before doing anything else**, confirm you are running in an isolated git worktree — not the
main repo. Check your current working directory. It should contain a worktree segment like
`/.claude/worktrees/agent-<id>/`. If your working directory is the main repo path (e.g.,
`/workspaces/orianna/` without a worktree segment), STOP and report the error. Do not proceed
without isolation — you will overwrite other agents' work.

### Phase 3: Implement the design change

Tell the user: **"Phase 3: Implementing the design change"**

Make the code changes to implement the design direction.

**How to use the concept image**: The concept image is AI-generated and should be treated as
*directional guidance*, not a pixel-perfect spec. Use it to understand the intended layout,
visual hierarchy, and design treatment. However, expect and fix artifacts from AI generation —
garbled text, misaligned elements, impossible UI chrome, inconsistent spacing, or nonsensical
labels. Extract the *design intent* from the image and implement it cleanly using the real
codebase's components and patterns.

**Use the existing codebase as your design system.** Before writing any new styles or components:
- Study the existing components, patterns, and visual language already in the codebase
- Reuse existing components, utility classes, design tokens, color variables, and spacing scales
- Match the typography, border radii, shadows, and animation patterns already established
- If the codebase uses a component library (e.g., Radix, Chakra, MUI, shadcn), use those components
  rather than building custom ones
- If there are existing CSS conventions (CSS modules, Tailwind classes, styled-components, etc.),
  follow the same approach — don't introduce a new styling pattern
- Look at sibling components for reference: how do they handle similar layouts, states, or
  interactions? Mirror that approach.

The design should feel like it belongs in the existing app, not like a foreign element was dropped in.

Implementation rules:
1. Keep changes minimal and focused — only change what's needed for the design
2. Don't refactor surrounding code or add unnecessary abstractions

### Phase 4: Wire the app to showcase the change

Tell the user: **"Phase 4: Wiring the app to showcase the change"**

**THIS PHASE IS YOUR ACTUAL DELIVERABLE.** The app will be shown as a live preview to the PM to
show the design direction. When it loads at `/`, the design change must be
immediately visible. Users should not have to take a single action to see the change. The user can then interact with the app from that state to get a feel for how the change fits into the experience.

Before writing any code for this phase, answer these questions:
1. What currently renders when you open `/` in a browser?
2. Is the design change visible on that page? If not, what page is it on?
3. What do you need to change so that opening `/` directly shows the design change?
4. What data does that page need to render properly and be interactable for the user?

The answer to #3 & #4 is your task. The default route `/` must render the design change directly. If
`/` currently shows a home page, list page, or landing page, change it so it redirects to or
renders the page with the design change instead. If that page needs data to render, seed the data
at the application layer — hardcode initial state, mock an API response, or create a fixture.

The mock data must be realistic enough that the app actually works from that point forward. The
user will click around and interact with it — if the data is missing or fake-looking, the
experience falls apart. Open any modals, drawers, or dialogs needed to display the design change. Set any toggle states or tab selections to the right position.

Ensure your variant's UI is visible immediately without requiring existing app state. If rendering
is gated behind state-dependent conditions from the original code (e.g.,
`if (!selectedItem) return null`), add a bypass so the change is always visible when the app loads.
This includes both component-level guards (e.g., `if (!selectedItem) return null`) and route-level
guards (e.g., auth redirects, layout wrappers that conditionally render children).

### Phase 5: Start the app

Tell the user: **"Phase 5: Starting the app"**

Use the `start-application` skill to start the application on your assigned port. Wait for it to
come up and verify it's running.

When done, return:
- A summary of what was changed (files modified, components added)
- The URL where the design is visible: `http://localhost:<port>/`
- Any caveats or follow-up suggestions
