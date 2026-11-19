---
# Standalone Card only (cortex-write-task Branch A): keep this block. A Card in a set: delete it.
task_name: [Task Name - Title Case]
created: YYYY-MM-DD
completed:           # Set when done
status: pending      # pending | in-progress | completed | deferred
categories: []       # From cortex/PROFILE.md §2 (Categories)
model: standard
skills: []           # load before starting; empty if none
tracker:             # optional: path#ID[,ID]
---

# [TYPE]_[##]_[task-title]: [Title]

> **Card:** every decision is made here. Need one that isn't? Stop and return `BLOCKED`, naming it.
> **Rules:** PLAN.md House Rules and the project's standing rules · touch only the files below ·
> no breaking change without the user · no PII in examples · as a sub-agent, no git commands that change state.

**Objective:** [One sentence: the observable result.]

**Files**
- `path/to/file.ext` (`symbolName`): [what changes]

**Steps**
1. [An edit a careful person could make without reading anything else]
2. [Next edit]

**Proof**
- Write first: [the failing test, and where]
- Run: `[exact command]`
- Passing looks like: [the result]

**Stop if**
- [Something that would mean this is not the task you were given]

---

## Implementation Notes

_Written in full by the executor. Never capped: the orchestrator and the final review check the
work against them. Re-run? Add a `### Run N` block below the last one; never overwrite one._

**Status**: Pending  
**Completed**: YYYY-MM-DD HH:MM

### Changes Made
- 

### Checks and Results
- [What you ran or measured, and what it showed]

### Caught Beyond the Brief
- None / [what you noticed that this task didn't ask about]

### Deviations from Plan
- None / [Describe if any, and why approved]

---

## On Completion

1. Fill in Implementation Notes; set **Status** to `Completed`. Standalone: also set `status: completed`
   and `completed:` in the frontmatter, and if `tracker` is set, delete those rows and rewrite Status.
2. In a set: update this task's row in [TASK-STATUS.md](./TASK-STATUS.md) — your row only.
3. Append **your own** LOG entry to `cortex/LOG.md` — one line, terminated with a newline,
   append-only (never `str_replace`). Other tasks may be appending at the same moment.

   ```
   [[YYYY-MM-DD HH:MM]] [CATEGORY] [TYPE]_[##]: [what you did] → Task: [[link to this file]]
   ```

   `[CATEGORY]` from `PROFILE.md` §2. Cite files by path + symbol, never by line number.
4. Standalone and not a sub-agent → commit once verified (`cortex-task-exe` § Commits). A sub-agent →
   don't; the orchestrator commits.

> In a set, the **set** entry is written once, by whoever closes the set (`cortex-task-exe` § Task-Set
> Frontmatter Lifecycle). Do not write to `AUDITED.md`; that is `cortex-garden`'s ledger alone.
