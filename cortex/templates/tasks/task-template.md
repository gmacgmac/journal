# [TYPE]_[##]_[task-title]: [Task Title]

<!-- 
  FILENAME MUST follow: [TYPE]_[##]_[task-title].md
  [TYPE] marks work type / agent assignment: BE (Backend), FE (Frontend),
  VERIFY (Verification), MANUAL (Human action), or a domain tag (e.g. API);
  use T for a generic single-stream task.
  Example: API_01_create-user.md
  NEVER create files like 01.md without a descriptive title!
-->

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Plan**: [PLAN.md](./PLAN.md)

---

## Objective

[One sentence: what does this task accomplish?]

---

## Context

_Only what PLAN.md, the code and the project's standing rules don't already say. Delete if empty._

**Read previous task notes in TASK-STATUS.md before starting.**

---

## Inputs

> **Use relative paths from project root** — DO NOT use absolute `file:///...` URLs.

- **Files to modify**: `path/to/target.extension`
- **Files to reference**: `path/to/reference.extension`
- **Patterns to follow**: [Link or description]
- **Shared artifacts to reuse**: `path/to/shared.ext` (`symbolName`) — built by [TASK_ID]. Import it; do not re-create it. See TASK-STATUS.md Shared Foundations.
- **Skills**: `cortex-architecture` (dev work) · `cortex-docs` (doc work, or code a doc describes) · `cortex-research` (investigation only), plus any project skill the task needs — load before starting. Delete if none apply.

> Modify only the files this task owns (TASK-STATUS.md File Ownership, or *Files to modify*).
> Need a change in a file you don't own? Don't make it — list it under `REQUESTS` in your return block.

---

## Steps

1. [ ] [First step - be specific]
2. [ ] [Second step]
3. [ ] [Third step]

---

## Validation

- [ ] [How to verify this works]
- [ ] [Specific test or check]

---

## Implementation Notes

_To be completed by agent after task completion._
_Re-run? Add a `### Run N` block below the last one; never overwrite an earlier run._

**Status**: Pending  
**Completed**: YYYY-MM-DD HH:MM  

### Changes Made
- 

### Issues & Resolutions
- 

### Caught Beyond the Brief
- None / [what you noticed that this task didn't ask about]

### Deviations from Plan
- None / [Describe if any, and why approved]

---

## On Completion

1. Fill in Implementation Notes above; set **Status** to `Completed`.
2. Update this task's row in [TASK-STATUS.md](./TASK-STATUS.md) — your row only.
3. Append **your own** LOG entry to `cortex/LOG.md` — one line, terminated with a newline,
   append-only (never `str_replace`). Other tasks may be appending at the same moment.

   ```
   [[YYYY-MM-DD HH:MM]] [CATEGORY] [TYPE]_[##]: [what you did] → Task: [[cortex-tasks/{concern}/{task-folder}/[TYPE]_[##]_[task-title].md]]
   ```

   `[CATEGORY]` from `PROFILE.md` §2. Cite files by path + symbol, never by line number.

> The **set** entry is written once, by whoever closes the set — the orchestrator, or with no
> orchestrator the agent that finishes the last row (`cortex-task-exe` § Task-Set Frontmatter
> Lifecycle). As a sub-agent, never write it. Do not write to `AUDITED.md`. That is `cortex-garden`'s ledger alone.
