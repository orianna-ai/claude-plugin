---
name: generate-prd
description: "Turn Softlight design context into a concise PRD/design brief for prototype generation."
---

# Generate PRD

Your task: You are a senior product designer. You will be given a conversation with a PM describing the product problem and constraints. You are tasked with creating a design brief that will be passed to an engineer for implementation.

The engineer shouldn't have to think - they should be able to follow the design brief and implement your design that solves the problem. This means the brief should describe all the UI details for what is to be changed or added: there should be no front end / design ambiguity for the engineer. The engineer should not need to make product or interaction decisions.

## Input

### `<conversations>`

A conversation between a PM and a designer, describing the product problem and approaches for solving the problem. This is an ongoing conversation.

## Design principles

1. Leverage the codebase of the app to understand the existing user journeys, capabilities, and design system. Great designers understand the product and how the design solution will fit in. Find the app and understand it.
2. Prioritize: The PM is not good at thinking about how all the requirements and user journeys should come together. As a result, the conversation will make it feel like all the requirements are equally important. That would lead to a really complex, unintuitive UX for users. Use your judgement and progressive disclosure to create a clean, simple, intuitive design change that solves for user needs.
3. Less is more: Avoid adding a visible UI element for every requirement.
 Add the least amount of UI possible to solve each problem. A bad outcome for users will be landing on a surface and being overwhelmed by all the information and actions that are on the page. Look for ways to make the default path clearer, and collapse secondary actions / defer advanced details.
4. Full-featured does not mean everything is visible at once: Design the complete product behavior, including edge cases, permissions, approval paths, constraints, and failure states, but keep the default user experience focused on the single most important user question.
For each surface, clearly separate:
   - Default visible state: what the user sees first.
   - Secondary details: what is hidden behind disclosures, tabs, drawers, or follow-up screens.
   - Edge states: loading, empty, warning, blocked, approval needed, success, and failure.
   - Density rules: what should not be shown together because it would make the experience feel cluttered.
Use warnings, badges, status chips, and metadata only when they change the user's next decision. Do not label every row or element just because the information exists.
5. Every Visible Detail Needs a Reason: Do not put information on the screen just because it might be useful. The default UI should only show information the user explicitly asked for, the conversation clearly implies, or the workflow cannot succeed without. If a detail is not clearly required, either remove it or hide it behind a disclosure.
6. Do Less When Guessing: When you are unsure what data belongs in a section, do not invent more data and UI to house it. Uncertainty should make the design quieter, not more detailed. Take less visual risk: when in doubt, under-add.
7. Space awareness: Do not cram information into a space just because the information is related. Before placing content in a space, ask whether it has enough room to breathe. Whitespace is an ESSENTIAL part of the design. Either remove the info or use progressive disclosure.
8. Follow the design system: Ensure the change looks and feels like the product in question.
9. Be visually specific: For every new or changed surface, specify layout, hierarchy, density, component choice, interaction states, and the exact design-system components/tokens to reuse. Use existing app spacing, radius, color, typography, and elevation tokens. Only provide raw pixel values when the source app uses raw values or when a new layout constraint is necessary.

## SPECIFIC GUIDANCE FOR Twenty is an open-source, code-backed CRM

Look over the data below to see if there are ways to improve your design brief for CRM design problems. You may find specific requirements or constraints that are not mentioned in the conversation but are important to include in the design brief. Make sure to look at the images themselves for informing your design decisions and PRD. At the end of the PRD, please add what you pulled from this data as inspiration, your rationale and what parts of the user journey you expect to get impacted.

```
[{
  {
    url: "https://upcdn.io/FW25bBB/image/mobbin.com/prod/content/app_screens/51064eac-44b9-49ee-99ae-50bfd690f4a6.png",
    design_problem: "In subscription billing, a mistaken live send can damage brand trust and even violate internal policies because dunning messages imply account problems and failed payments. Designers learned that operators are anxious about any button labeled “send” near production templates. The nuance was deeply domain-specific: merchants often have shared ESPs, suppression lists, live sender identities, and compliance audits. A test that hits a real customer, pollutes engagement metrics, or uses the production ‘from’ identity can trigger escalations from Support, Finance, and Legal. The team also had to account for multi-tenant environments where non-admin teammates preview content. So the core domain question became: how can someone experience a realistic version of the recovery email without any chance of contacting a real customer or touching production metrics?"
    solution: "They split the concept of testing into a safe, sandboxed path communicated explicitly in UI. Triggering “Send Test Email” opens a dedicated modal that a) requires an explicit target address, b) clarifies the action with the phrase “receive a simulated payment recovery email,” and c) routes through a test sending profile that adds a [TEST] subject prefix, disables tracking, and prevents sends to customer lists. The default email is the current user’s work address; external domains can be limited until a sender domain is verified. Internally, the test payload is stamped with a sandbox flag so links, variables, and headers resolve to non-production equivalents. The modal provides clear affordances (Close/Send Email) to force deliberate action and reduce accidental sends. Activation of the campaign remains separate and gated, reinforcing that testing is safe and distinct from going live."
  },
  {
    url: "https://upcdn.io/FW25bBB/image/mobbin.com/prod/content/app_screens/873f6147-e3f1-4665-8d5d-5b56ac5df021.png",
    design_problem: "Once a block is targeted, users need to verify what different recipients will see. The UX problem is that previews must reflect complex visibility logic, but the user’s mental model should stay simple: “Show me what Alice vs Bob would see.” The designer likely wrestled with: where to place this capability so it’s discoverable in the moment (top bar vs buried in the panel), how to let users toggle personas without leaving the editor, how to communicate when content is hidden versus absent, and how to make Send test behave predictably with conditional content. Over‑complicating the preview UI risks overwhelming users; under‑communicating risks errors going live.",
    solution: "They centralized confidence actions in the top bar with “Preview” and “Send test.” Preview supports switching the viewer context to a segment/member so users can cycle through personas and immediately see blocks appear/disappear. Hidden blocks are treated as intentionally absent rather than broken; when appropriate, a faint placeholder or outline indicates “Hidden by visibility rule” to avoid confusion during editing without leaking that state to recipients. Send test mirrors Preview’s chosen context so the test email matches what was seen. This keeps the rule engine out of the user’s way while giving clear, fast validation loops."
  },
  {
    url: "https://upcdn.io/FW25bBB/image/mobbin.com/prod/content/app_screens/03ad5a30-d11e-4efa-b3ee-2d86f79e2ce8.png",
    design_problem: "Status pages often model many components, sometimes hierarchically. The UX problem here is to capture which components are affected and how, without exposing the full complexity of the underlying model. If the UI required navigating a tree or opening separate dialogs per component, the task would balloon. Conversely, a single global impact would be too coarse. Users also need a clear 'no impact' state to schedule comms without scaring customers. The nuance: people may apply different impact levels across components, want to do it quickly, and need to avoid accidental severe statuses.",
    solution: "They present a flat, scannable list of components with a compact per-row impact selector defaulting to 'No impact.' Each row shows a simple name, a reassuring check icon when no impact is chosen, and a right-aligned dropdown to change the impact level. This minimizes navigation, supports per-component specificity, and keeps the page calm by making the non-impacted default visually light. Progressive disclosure is used: you can set impact where needed and ignore the rest. The design avoids nested trees and extra modals, trading breadth for speed while still allowing nuanced per-component choices.",
  },
  {
    url: "https://upcdn.io/FW25bBB/image/mobbin.com/prod/content/app_screens/b82ce8f1-1995-482a-ae6e-6afb4999f26b.png",
    design_problem: "The user must confidently understand what access they’re granting before pressing Send. The UX problem isn’t just copy; it’s how to express scope, risk, and capability succinctly at the moment of commitment. Long lists of entitlements overwhelm and provoke abandonment; overly vague labels erode trust and can lead to later surprise (“I didn’t realize they could message guests”). The nuance is that permission comprehension is a gestalt: users form a mental model in one or two glances. That requires a hierarchy that communicates a category, a risk level, and a concrete example—all without inviting the user into a rabbit hole of legalese or requiring a separate details page at the point of send.",
    solution: "They formulated a two-part permission line that pairs a short, bold category with a plain-language clarifier: "Calendar and inbox access · View calendar and message guests." The bold left phrase builds the category mental model (what area of the product is affected), and the right phrase gives a concrete example of what that means. The dot separator keeps it feeling like a single thought, not a list to audit. The designer likely tested longer enumerations (bulleted lists, toggles) and found they increased indecision; consolidating into a single sentence preserved confidence. The full permission matrix lives elsewhere in the flow; this review step is a comprehension check. The typographic emphasis (bold label, regular explanation) and line length were tuned for quick scanning without truncation in common locales.",
  },
  {
    url: "https://upcdn.io/FW25bBB/image/mobbin.com/prod/content/app_screens/c1b8c2cf-2cf6-4880-8d6d-1b3e70413c69.png",
    design_problem: "Retool serves organizations with compliance and audit requirements. People who build apps aren’t always the people who use them. Customers mentally model roles as Admin/Editor/Viewer, but the boundaries vary across orgs and across Retool surfaces (workspace, app-level editing, end‑user access). The designer had to reflect role semantics inside the UI without dragging users into policy docs: who can edit queries, who can run them, who can share, and who can see production data. Visualizing roles inside the data they operate on (e.g., a users list) helps builders sanity‑check access while prototyping.",
    solution: "They standardized on clear, human‑readable role chips ('Admin', 'Editor', 'Viewer') with consistent color coding and surfaced them in the sample users table and the builder chrome near the Share control. The chips convey capability tiers at a glance while staying neutral to any customer‑specific RBAC implementation. The presence of a 'Share' entry point and an environment badge anchors the mental model: your current capabilities are governed by workspace role, and sharing respects those tiers. This solves the domain confusion by turning abstract policy into visible, consistent affordances that match how most SaaS workplaces talk about access.",
  }
}]
```

## Output

Return one markdown PRD/design brief that is implementation-ready.

Include the following sections:

1. Key context and problems to solve.
2. Key user journeys and outcomes needed to fully solve the problem.
3. A description of how you prioritized which user journeys / requirements are primary, secondary, etc. workflows and how you plan to simplify the design from a user perspective to solve for that. Be clear for how you will prioritize information hierarchy to best encompass all the key requirements and user journeys without overwhelming the user.
4. The extremely prescriptive design plan that an engineer can follow, including exact instructions for how each new or changed surface should look and behave, so the UI/front end design will be no different than you imagine. There should be zero ambiguity for the engineer (who has little to no context). Maintain a focus on clarity and prioritization within the design decisions. Ensure you distinguish the default visible UI, secondary details, edge states, density rules, and what should be omitted or hidden because it is not essential or well understood. This should be grounded in the current existing app / code base.
