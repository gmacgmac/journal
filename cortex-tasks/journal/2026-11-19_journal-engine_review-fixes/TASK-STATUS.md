---
task_name: Review Fixes
created: 2026-11-19
completed:
status: planned
categories: [journal-engine, journal-format, journal-contract, journal-view]
tracker:
---

# Review Fixes - Task Status

> **Plan**: [PLAN.md](./PLAN.md)  
> **Created**: 2026-11-19

---

## Instructions for Agents

1. **Read PLAN.md first** to understand full context
2. **Read notes from completed tasks** before starting yours
3. **Respect the Wave column** — do not start a task whose wave has not been reached
4. **Reuse Shared Foundations** — import, do not reinvent
5. **Touch only the files you own** (File Ownership below). Need a change elsewhere? List it under `REQUESTS` in your return block
6. **If you need to deviate, STOP and inform the user**
7. **Update frontmatter `status`**: `planned` → `in-progress` when you start; closing the set is the orchestrator's job
8. **Update your row** in the Task List table when you finish
9. **Add implementation notes** to your task file and brief notes here
10. **No git commands that change state** — the orchestrator commits each passed wave

---

## Task List

| # | ID | Wave | Model | Own worktree | Persona | Task | Status | Notes |
|---|-----|------|-------|--------------|---------|------|--------|-------|
| 1 | BE_01 | 1 | strong | no | Principal storage engineer — an edit names what the person saw and is refused, never guessed, when the file has moved on; every write keeps the day's rules. | [Engine edits and entry rules](./BE_01_engine-edits.md) | Pending | |
| 2 | FE_02 | 1 | standard | no | — | [Split the stylesheet](./FE_02_stylesheet-split.md) | Pending | |
| 3 | FE_01 | 2 | strong | no | Staff front-end engineer — the view states intent and the engine owns the bytes; every interaction has a test that drives it as a person would. | [View on the new edits, drag tests](./FE_01_view-edits.md) | Pending | |
| 4 | DOC_01 | 3 | strong | no | Technical writer for developer platforms — every sentence about the code names the symbol and the test that keeps it true. | [Spec true to the code](./DOC_01_spec.md) | Pending | |
| 5 | VERIFY_01 | 4 | standard | no | A person who keeps a journal in a notes app they love — expects writing, moving and removing to just work, and nothing to be lost. | [Final verification](./VERIFY_01_testing.md) | Pending | |

**Status Values**: `Pending` | `In Progress` | `Completed` | `Blocked` | `Deferred`

---

## Shared Foundations

| Artifact | Created by | Consumed by |
|----------|-----------|-------------|
| `src/format/entries.ts` (`entrySpans`, `placesFor`, `hasWriting`) | BE_01 | FE_01 |
| `src/seam-types.ts` (`Edit`: `move`, `remove`, `clear`) | BE_01 | FE_01, DOC_01 |
| `tests/view/css.ts` (reads the stylesheet with its partials) | FE_02 | FE_01 (if it reads CSS), VERIFY_01 |

---

## File Ownership

| Wave | Owner | Files |
|------|-------|-------|
| 1 | BE_01 | `src/seam-types.ts`, `src/format/` (new `entries.ts`, `index.ts`), `src/store/`, `src/engine/`, `words/words.json` (engine `journal.problem.*` keys only), `tests/format.test.ts`, `tests/store.test.ts`, `tests/routes.test.ts`, `tests/tools.test.ts`, `tests/budget.test.ts` |
| 1 | FE_02 | `src/view/journal.css`, new `src/view/css/`, `src/view/css.d.ts`, `vite.config.ts`, `bin/scope-css.ts`, `tests/view/css.ts`, `tests/view/colours.test.ts`, `tests/view/touch.test.ts`, `tests/view/build.test.ts` |
| 2 | FE_01 | `src/view/*.ts` (not CSS), `words/words.json` (`journal.view.*` keys only), `tests/view/*.test.ts` except those FE_02 owned, new `tests/view/drag.test.ts`, `tests/view/fake-dom.ts`, `tests/view/fake-host.ts` |
| 3 | DOC_01 | `docs/specification/plugin.md`, `README.md`, `skill/SKILL.md` (only if a claim there is now untrue) |
| — | orchestrator | `package.json`, `package-lock.json`, `src/vendor/`, `cortex/PROFILE.md`, `cortex/REGISTRY.md`, `dist/` |

---

## Requests

| Request | From | Need | Routed to | Status |
|---------|------|------|-----------|--------|

---

## Implementation Notes

### BE_01: Engine edits and entry rules
_Status:_ Pending  
_Notes:_ 

### FE_02: Split the stylesheet
_Status:_ Pending  
_Notes:_ 

### FE_01: View on the new edits, drag tests
_Status:_ Pending  
_Notes:_ 

### DOC_01: Spec true to the code
_Status:_ Pending  
_Notes:_ 

### VERIFY_01: Final Verification
_Status:_ Pending  
_Notes:_ 

---

## Completion Checklist

- [ ] All implementation tasks complete
- [ ] Verification task complete
- [ ] Every request `Done` or `Closed`
- [ ] LOG entry created

---

## On Completion

1. Frontmatter `status: completed`, `completed: YYYY-MM-DD`
2. Append: `[[YYYY-MM-DD HH:MM]] [journal-engine] Completed set: Review Fixes → Task: [[cortex-tasks/journal/2026-11-19_journal-engine_review-fixes/TASK-STATUS.md]]`
3. Commit the close; fast-forward `main`.
