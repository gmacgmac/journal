---
name: cortex-architecture
description: "How code is organized so it stays reusable, consistent and testable: reuse-before-create, one job per file, one source per contract (schema → code → OpenAPI → MCP), one layer per concern, one action layer for people and agents, central registries for dependencies, conditions and jobs, one home per sentence (words files), and one home per icon and brand asset. Use when planning or building front-end, back-end, API, MCP, schema, data-layer or shared-component work. Not for visual design — how the UI looks."
---

# Architecture

How things are organized, not how they look. Strong models write good code locally; what they
don't do by default is keep a whole codebase to **one home per fact**. This skill is that
discipline.

**Patterns, not mandates.** These come from experience on real projects. **Where project steering
defines an approach, it wins**: this skill applies only where the project hasn't decided yet, as a
reference to consider, not a rule to follow. A project adopts the parts that fit: a docs-only repo
may use only one home per fact; a repo with no UI or agents skips words files; a repo with no API
skips contracts. Where a choice depends on the project, this skill asks the question and lists
common answers rather than naming one. Project numbers and choices (file-length limits, layer
names, token names, where job state lives) belong in project steering. The planner picks for this
plan, and proposes recording the choice in project steering, so later plans make the same choice.

**Applied at planning.** The planner (`cortex-write-task`) loads this skill for dev work and
writes its decisions into the plan — which pattern each piece reuses, which contract comes first,
what goes in Shared Foundations. Executing agents follow the task; they consult this skill only
where the task names it.

## Before you build — answer in order; settle each point before the next

1. **Is it planned?** Non-trivial work is planned in a task file first; trivial work needs none
   (`cortex-change-protocol` § Trivial changes).
2. **Does a pattern already exist?** Search for it (UI component, request helper, action, test
   fixture). Extend it before creating one.
3. **Is the contract defined?** Data shapes and endpoints exist in the schema / spec first. Missing
   → change the contract, then build.
4. **Does an action already exist?** Anything a user or agent can do goes through the action layer.
   Not everything is an action; unsure → ask the user (`references/actions.md` § Is it an action?).
5. **Does a decision already cover it?** Follow it, or plan a superseding decision.
6. **Will a second place need to know this?** If yes, it goes in a registry (rule 6,
   `references/registries.md`), not a local check.
7. **Does it show or send a sentence?** It goes in a words file (rule 7), not in the code.
8. **Does it draw an icon or brand asset?** It comes from its home (rule 8), never inline.

## The rules

1. **Reuse: import, never paste; promote repeats.** Call existing code where it lives. Near fit:
   widen the shared code (every caller's tests stay green) or import it and add only the difference.
   A shape seen twice that means the same thing gets one home the rest import. A copy is a
   missing pattern. Copies are allowed only across a hard code boundary, held equal by a test.
2. **One job per file.** Default: aim for ~300 lines, functions ~50; the project's check fails
   past its limit. Split at a seam — move a cohesive unit (component, helper group, types) into
   its own file. Never squeeze: no joined lines, cut comments or shortened names.
3. **A split module keeps its public file.** `store/skills.ts` stays the one import; its parts
   live in `store/skills/`. Code outside the folder imports only the public file.
4. **One source per contract.** Every contract has exactly one source; everything else is
   generated from it or tested against it. See `references/contracts.md`.
5. **One layer per concern, one interface into it.** Callers use the interface and never reach
   past it to the storage or mechanism behind. That single point is where logging, routing,
   testing and later swaps (memory → database, one provider → another) happen, without touching
   a caller. Defaults: one request / I/O layer (only it calls APIs or touches files; it validates
   what it reads and writes). One action layer shared by people and agents
   (`references/actions.md`). A button never calls an API directly.
6. **App-wide awareness goes through registries.** Once a second place needs to know, a local
   check moves to a table. Dependencies are edges in a references table; facts more than one
   place must know are rows in a conditions table; long-running work, once there is more than one
   kind, is tracked in a jobs table. Each table is added only when needed. See
   `references/registries.md`.
7. **Words have one home.** Every sentence a person or an agent reads — screen text,
   notifications, errors, tool descriptions and refusals — lives in a words file for its area,
   never in the code that shows or sends it. Code imports the words. Start the home with the
   first screen; add the test that enforces it once text spans several files. See
   `references/words.md`.
8. **Visual assets have one home.** UI icons come from one icon set: a module mapping each name
   to a drawing. Components render icons by name, never inline SVG. Each meaning has one icon,
   and each icon one meaning; a new icon joins the set before use. Brand assets (characters,
   illustrations, app icons, motion) live in one source folder, such as `brand/` at the root,
   and a script deploys them to every place that uses them. Change the source once; never
   hand-edit a deployed copy. Data drawings (charts, meters, progress rings) aren't assets;
   draw them where used. A test fails on an inline icon and names the fix. Existing offenders
   go on a list that may only shrink, so the rule lands before the clean-up.
9. **Mock the data, not the screens.** Fixtures in the exact contract shape; switching to real
   data is a setting, not a rebuild.
10. **UI structure is pattern-owned.** Each control in a plan names the component it reuses,
    decided at planning; no fit → ask the user. Style comes only from design tokens. Every state
    (idle, hover, focus, pressed, loading, success, error, disabled; data: loading, empty, error,
    partial, stale) belongs to the pattern, so a screen gets it by reuse. Accessibility is a gate.
11. **A bug fix starts with the failing test.**
12. **Prompts and agent instructions are code** — versioned, reviewed, and run against scenarios
    before they change.

## Planning outputs

When this skill shapes a plan, PLAN.md / task files record:
- the existing pattern or module each piece reuses (path + symbol);
- the contract change that comes first, and the tests that hold code to it;
- any new action: its id, permission, flags (changes data, needs a click, cost) and which
  agents may call it;
- any new registry row (reference edge, condition or job kind) and who reads it;
- the words file each new sentence goes in;
- when a UI task needs a new icon, the icon set as a file it may change;
- shared artifacts in TASK-STATUS.md Shared Foundations.

Docs that describe this code are held true by `cortex-docs`.
