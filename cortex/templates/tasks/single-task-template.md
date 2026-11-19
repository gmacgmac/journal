---
task_name: [Task Name - Title Case]
created: YYYY-MM-DD
completed:           # Set when done
status: pending      # pending | in-progress | completed | deferred
categories: []       # From cortex/PROFILE.md §2 (Categories)
type: implementation # implementation | research | analysis | migration | review
model: standard      # standard | strong — mapped to a model by project steering
persona:             # optional: <real job title> — <1–2 sentences: what they won't compromise on>; required for review and strong tasks
skills: []           # cortex-architecture (dev work) | cortex-docs (doc work) | cortex-research | any project skill — load before starting
tracker:             # optional: path#ID[,ID]
---

# Task: [Task Title]

---

## Problem Statement

[Brief description of what problem this task solves or what needs to be done. 2-4 sentences.]

---

## Steps

[Numbered steps. Add per-step file paths or detail only where the approach isn't obvious.]

1. [First step]
2. [Second step]
3. [Third step]

---

## Files Involved

> **Use relative paths from project root**.
> DO NOT use absolute paths — task files must be portable.

| File | Purpose |
|------|---------|
| `path/to/target.extension` | Target for changes |
| `path/to/reference.extension` | Reference implementation |

> Modify only the files listed for changes here. Need a change elsewhere? Don't make it — list it
> under `REQUESTS` in your return block (sub-agent), or tell the user.

---

## Constraints

- **DO NOT** [specific thing to avoid]
- **STOP** and alert user if [unexpected condition]

---

## Success Criteria

- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] Task file updated with completion notes

---

## References

> Use relative paths (e.g., `docs/dev/...`), not `file:///...` URLs.

- `path/to/relevant-doc.md`
- `path/to/related-file.extension`

---

## Implementation Notes

_To be completed by agent after task execution._
_Re-run? Add a `### Run N` block below the last one; never overwrite an earlier run._

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

1. Update frontmatter: `status: completed` and `completed: YYYY-MM-DD`
2. Append your LOG entry — one line, terminated with a newline, append-only (never `str_replace`):
   ```
   [[YYYY-MM-DD HH:MM]] [CATEGORY] Completed: [task_name] → Task: [[Link to this file]]
   ```
   `[CATEGORY]` from `PROFILE.md` §2. Cite files by path + symbol, never by line number.
3. If `tracker` is set, delete those rows and rewrite Status.
4. Not a sub-agent → commit the task once verified (`cortex-task-exe` § Commits). A sub-agent →
   don't; the orchestrator commits.

> This is a standalone task, so this entry is the whole record — there is no set entry. Do not write
> to `AUDITED.md`; that is `cortex-garden`'s ledger alone.
