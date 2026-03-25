# Pipeline Simplification Spec

## Context

The run-orchestrator pipeline was too complex: 17 serial stages, ~189 subagent invocations, and
~14 skills. Every judgment call was decomposed into a separate agent with its own codebase
exploration, image downloading, and feedback extraction rituals. The models don't need that level
of hand-holding.

## What we've already implemented

### 1. Merged problem statement + ideation into one agent (`explore-and-ideate`)

**Before:** Two separate agents ran in sequence. `generate-problem-statement` explored the
codebase and wrote a problem statement. Then `plan-new-ideas` explored the same codebase again,
viewed baseline screenshots, came up with 4-6 design ideas, wrote a plan JSON, uploaded it, and
called `dispatch_prototype`.

**After:** One agent (`explore-and-ideate`) explores the codebase broadly — understanding the
product, its components, design system, and patterns — then produces both the problem statement
and 4-6 design ideas. It writes them to `/tmp/explore_and_ideate.json`. The orchestrator handles
all the dispatch mechanics (creating slots, formatting the plan JSON, uploading, calling
`dispatch_prototype`).

**Key design decisions:**
- The agent explores the product broadly (not just "why does this problem exist") so it naturally
  absorbs the design system.
- Design ideas are described naturally in an `idea` field — no mandated sentence count, no
  spec/caption split. Whatever communicates the idea clearly.
- The agent runs AFTER the app is started (not in parallel), so it can see a screenshot of the
  running app before proposing ideas.

### 2. Content script generator now explores the codebase first

**Before:** The `generate-content-script` skill assumed a `<context>` input with pre-explored
source code analysis (routing, auth, data fetching, styling). But `dispatch_prototype` never
actually provided this context. The agent got a short spec and was told to "maybe" read files if
something was missing — treating codebase exploration as a fallback.

**After:** Added Phase 1: "Understand the app" — the agent explicitly explores the codebase
before writing any code, just like Cursor does when you ask it to build something. It reads
routing, components, data fetching, and styles. Specifically called out: understand the design
system so any UI changes look like they belong in the product. The aspirational `<context>` input
field was removed.

### 3. Updated orchestrator Phase 1 sequencing

**Before:** Three subagents ran in parallel: content script (baseline), start-environment, and
problem statement generation. The ideation agent never saw the running app.

**After:** Two-step setup:
- 1a: Content script + start-environment run in parallel
- 1b: After both complete, screenshot the running app, then run explore-and-ideate with the
  screenshot so it can see the product before proposing ideas

### 4. Orchestrator dispatches directly (no planner subagent)

**Before:** Orchestrator called `plan_prototype_revision`, dispatched a `plan-new-ideas` subagent
that explored the codebase (again), wrote a plan JSON, uploaded it, and called
`dispatch_prototype`. The orchestrator then extracted events and dispatched content script agents.

**After:** Orchestrator reads designs from `/tmp/explore_and_ideate.json`, calls
`create_placeholder_slots` to get slot IDs, formats the plan JSON itself, uploads it, and calls
`dispatch_prototype` directly. No planner subagent.

---

## What to implement next: Merge evaluators into one agent

### The problem

The current pipeline has three separate evaluator agents that run in sequence after screenshots:

1. **PM evaluator** (`evaluate-prototypes`, 223 lines) — explores the codebase, views all
   baseline + prototype screenshots, reads specs, evaluates strategic direction, writes feedback
   as comment threads. Must complete before the designer starts.

2. **Designer evaluator** (`evaluate-prototypes-designer`, 200 lines) — explores the codebase
   again, views all baseline + prototype screenshots again, reads PM feedback, evaluates UX
   quality, writes more feedback as comment threads.

3. **Visual evaluator** (`evaluate-prototypes-visual`, 162 lines) — explores the codebase again,
   views all baseline + prototype screenshots again, evaluates visual craft, writes prescriptive
   CSS-level feedback.

This creates three serial stages where each agent redundantly explores the codebase and views the
same screenshots. The orchestrator also has to snapshot PM comment IDs between steps so it can
later label which feedback came from which evaluator. Then in Phase 6, it does elaborate
comment-threading work to build per-prototype feedback blocks labeled by source.

### The solution

Replace all three evaluators with a single `evaluate` skill. One agent, one codebase exploration,
one pass through the screenshots.

The agent is a **senior design lead** reviewing prototypes. It holds all three lenses
simultaneously:

1. **Strategic direction** — are these solving the right problem? Are any directions dead ends?
   Would any of these hurt the product? What hasn't been explored yet?
2. **User experience** — will these actually work for real users? Will users understand what to
   do? Are there flows that will confuse people?

The model is perfectly capable of holding both perspectives at once. It doesn't need to
roleplay as different people in sequence. Don't worry about the visual evaluator stuff. We're taking care of that separately.

### What the evaluator should do

**In addition to calling out problems, the evaluator should brainstorm concrete solutions —
specific design directions to try in the next iteration.** This is the key simplification we
discussed: the evaluator's output includes actionable next steps that go directly to content
script generation. No separate "extract feedback → plan variants" pipeline.

The evaluator should:

1. Explore the codebase to understand the product (same as other agents)
2. View baseline screenshots and all prototype screenshots
3. Review each prototype across all three lenses (strategic, UX, visual)
4. Post feedback as comment threads (for the Softlight canvas)
5. **Brainstorm 4-6 concrete solution directions for the next iteration** — specific design
   ideas that address the problems identified. These should be written clearly enough that a
   content script agent could implement them.

The evaluator writes the solution directions to a JSON file (like explore-and-ideate does) so
the orchestrator can read them and dispatch content script agents directly. No intermediate
planner subagents.

### What to do with the old skills

- `evaluate-prototypes` (PM) — will be superseded by the new `evaluate` skill
- `evaluate-prototypes-designer` — will be superseded by the new `evaluate` skill
- `evaluate-prototypes-visual` — will be superseded by the new `evaluate` skill

Don't delete them yet — they may be referenced by other skills. Just create the new `evaluate`
skill and update the orchestrator to use it.

### Orchestrator changes

The current orchestrator Phases 5-6 should be replaced:

**Current Phase 5** (3 serial steps):
- 5a: PM review → wait
- 5b: Snapshot PM comment IDs
- 5c: Designer review → wait

**Current Phase 6** (elaborate feedback extraction):
- Call get_project, diff comment IDs to label PM vs designer, map comments to prototypes by slot
  reference, build per-prototype feedback blocks

**New Phase 5** (1 step):
- Dispatch the `evaluate` skill. Pass it project_id, problem_statement, user_prompt.
- It posts feedback as comment threads AND writes solution directions to a JSON file.
- No comment ID snapshotting. No labeled feedback extraction.

**Current Phase 7** (Idea Refinement — 6 serial sub-steps, ~35-50 agents) should be replaced
with a simplified iteration that uses the evaluator's solution directions:

- Orchestrator reads the solution directions from the evaluator's JSON output
- Creates placeholder slots
- Formats plan JSON, uploads, calls dispatch_prototype
- Extracts prompts, dispatches content script agents
- Screenshots
- Pick winners (one agent)

This is the same dispatch pattern as Phase 3 (initial prototypes) — just with different input
specs. No separate idea-variant-plan subagents. No separate idea-pick per prototype. One
holistic pick step.

### Skills to create

- `evaluate` — single evaluator combining strategic, UX, and visual review. Should also
  brainstorm solution directions for the next iteration.

### Impact

- **Agents eliminated per run:** ~3 evaluators → 1, plus the entire Phase 6 extraction step
- **Serial stages eliminated:** 2 (PM-then-designer sequencing, comment ID snapshotting)
- **Redundant codebase explorations eliminated:** 2 (designer and visual evaluator no longer
  re-explore what PM already explored)
- **Skills reduced:** 3 evaluator skills → 1
