---
name: cortex-task-audit
description: "Audit completed tasks against the LOG/AUDITED trail to catch unlogged, unfinished, or drifted work. Use when asked to audit tasks or reconcile what was done versus what was recorded."
---

# Task Audit

Validate that completed tasks in `cortex-tasks/` are properly logged. Report gaps.

## Inputs

- `cortex-tasks/` — scan for completed task files (frontmatter `status: completed`).
- `cortex/LOG.md` — the append-only work log.
- `cortex/AUDITED.md` — Gardener processing checkpoints. **Read-only here.**

---

## Process

1. **Establish the audit horizon** — read `AUDITED.md` (Gardener checkpoints) and `LOG.md` (prior `[cortex-task-audit]` entries) to find when the last audit ran. Read-only: this skill never writes to `AUDITED.md`.
2. **Scan task folders** — find tasks completed since last audit (`completed:` date in frontmatter > last audit date).
3. **Cross-reference** — for each completed task, verify it appears in `LOG.md` or `AUDITED.md`. A task is "logged" if there is a timestamped entry referencing its path or name.
4. **Generate gap report** — list tasks that are completed but missing from the log trail.
5. **Planning doc check** — check if completed tasks have related planning docs (PLAN.md, TASK-STATUS.md) that need transition (e.g., parent TASK-STATUS still shows `in-progress`).
6. **Registry sync audit** — check if `REGISTRY.md` references match the actual structure (category paths current, concern overrides valid, dead links removed).

---

## Output

Report to user with:
- Count of tasks audited.
- Gap list (completed but unlogged tasks) with paths.
- Planning doc inconsistencies found.
- Registry sync issues found.

---

## Close Loop

1. Append the audit record to **`cortex/LOG.md`** — one line, terminated with a newline, append-only:
   `[[YYYY-MM-DD HH:MM]] [cortex-task-audit] Audited X tasks. Gaps: Y. Route issues: Z.`
   This doubles as the horizon marker for the next audit. `AUDITED.md` is `cortex-garden`'s ledger —
   it records what has been *verified*, and only the Gardener verifies. Never write to it here.
2. Raise each gap as a `[needs-human-input]` LOG entry naming the task path and what's missing, so
   the Gardener picks it up. Do **not** back-date corrective entries for the original work without
   user approval — that work already happened and the user should confirm how it's recorded.
