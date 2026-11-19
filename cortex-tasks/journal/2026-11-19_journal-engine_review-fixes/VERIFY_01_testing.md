# VERIFY_01_testing: Final verification

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md) · **Plan**: [PLAN.md](./PLAN.md)

**Objective**: prove the set works as a person would use it, and report anything that does not.

**Files to modify**: none (report only; your notes in TASK-STATUS.md and this file).

**Steps**
1. `npm run check`; `npm test` (all pass; report the count); `npm run build:plugin`.
2. nclite's stylesheet check on the build: write a script in `temp/` (project root; make it) that imports `checkPluginStylesheet` from `/Users/dev/AI/nclite/engine/plugins/stylesheet.ts` and runs it on `dist/plugin/journal/view/journal.css`; it must report nothing. Delete `temp/` after.
3. Targeted: in `tests/store.test.ts` and `tests/view/drag.test.ts`, confirm a hand-spaced file moves and removes, a timed entry cannot be moved out of order, and Undo after Remove this day brings the day back (cite the test names).
4. `grep -rn "op: 'range'" src/view` — only undo.
5. Doc audit (`cortex-docs`): pick five claims DOC_01 added; check each symbol and test exists and says what the doc says.
6. Did any `standard` task (FE_02) make a design choice? Report it.

**Rules**: PLAN.md House Rules; no git state changes; Skills: `cortex-docs`.

## Implementation Notes
**Status**: Pending
