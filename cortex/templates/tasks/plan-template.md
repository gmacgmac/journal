# [Task Name] - Plan

> **Status Doc**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Created**: YYYY-MM-DD
>
> One page, not counting Decisions. Rules by reference, never copied in.

---

## Problem

[What is wrong or missing today, and where (file paths, component names). 2–4 sentences.]

---

## Solution

[The approach, in a sentence or two.]

1. **[Component/Area 1]**: [What changes]
2. **[Component/Area 2]**: [What changes]

---

## Decisions

_Omit if none. Every ruling the user made in conversation, quoted verbatim, so executing agents
never re-derive intent from chat. A risk the user accepted goes here too; any other risk goes in
the `strong` task it affects._

- [Decision — and why, if it matters]

---

## Dependencies

- [Ordering between tasks — what must finish before what, and why]
- [Shared code this set creates and later tasks consume — mirror TASK-STATUS.md's Shared Foundations]
- [External dependencies (APIs, packages, etc.)]

---

## House Rules

_The project's standing rules apply; never copy them here. List only what this set adds or
overrides, and omit a line that keeps its default, or the whole section if every line does._

- **Orchestrator-only files**: [e.g. lockfiles, generated code, version files — mirror TASK-STATUS.md File Ownership]
- **Commits**: orchestrator commits each checked task (sequential) or each passed wave gate (parallel) (default) / `none` (then no git worktrees)
- **Git worktree commands and resources**: [only when a task has `Own worktree: yes` — copied from REGISTRY.md `git_worktrees`: create command, remove command, per-task resources; omit if the defaults apply]
- **Project checks**: [e.g. file-length limits, required type-check]
- **Test time limit**: [e.g. 150 s per run]

---

## Out of Scope

- [What this set will NOT do]
