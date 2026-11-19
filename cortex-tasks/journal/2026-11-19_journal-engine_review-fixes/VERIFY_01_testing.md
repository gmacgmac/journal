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
**Status**: Completed  
**Completed**: 2026-11-19

### Results
- `npm run check` clean; `npm test` 291 pass, 0 fail; `npm run build:plugin` built `dist/plugin/journal`.
- nclite `checkPluginStylesheet('journal', bytes)` on `dist/plugin/journal/view/journal.css`: `[]` (the function takes the scope and bytes; scope is the plugin id).
- Targeted: hand-spaced file moves and removes: `tests/store.test.ts` "a hand-spaced file is moved and removed all the same, and each edit undoes by a range", `tests/view/remove.test.ts` "a hand-spaced file loses the entry as well: the engine finds the bytes, not the view". Timed entry out of order is `422 order`: `tests/store.test.ts` "move, remove and clear name an entry or a day, and the engine does the bytes (GM, 2026-11-19)". Undo after Remove this day: `tests/view/remove.test.ts` "Remove this day clears it by the version seen, keeps it on the sheet with no page, and Undo brings it back"; store side "move, remove and clear are applied through the store with an undo that restores the file".
- `grep "op: 'range'" src/view`: only `src/view/specs.ts` (Backspace `merge`, known, FE_01-N1); undo is built by the engine, not the view.
- Doc audit, five claims, all hold: (1) `entrySpans`/`placesFor`/`hasWriting` in `src/format/entries.ts` and the three `tests/format.test.ts` names; (2) date-line-only file is no page: `readPages` + `tests/routes.test.ts` bare-days test, `hasPage` in `src/view/days.ts`; (3) `move` to its own place leaves text untouched, missing id `409 changed`, `422 order`: `planMove`, store test lines for each; (4) `rebuilt` spacing, hand-spaced: store test; (5) `removeDay` sends one `clear` with the version, stays `placed`: `src/view/journal.ts` + remove tests, and `storeRefusal` maps `order` like `heading` (`src/engine/tools/write.ts`).
- Persona probe (throwaway script in `temp/`, deleted): `planMove`/`planRemove`/`planClear` run on a day with no trailing newline, bodiless entries, two entries at one time (ids `-0`,`-1`, swap and remove each exact), identical entries, a list as the last block, hand-spaced file. Every result keeps the day's rules (`checkDay` empty), ends in `\n`, and drops no word except the removed entry's own; entries are never merged; timed moves are refused `order`, stale ids `409`; a stale `clear` is `409`. A day with text before its first entry already breaks the rules and every edit is refused `malformed`, so nothing is dropped.

### FE_02 design choices
- Seven themed partials, each wrapped in its own `.journal { }` (except root), so the built sheet has six more `.journal{` openers; an `@import` index in `journal.css`; `readStylesheet()` test helper. The split by theme (root, sheet, writing, drag, bar, phone, print) was FE_02's. Stray `-c1-40.css` is gone.

### Noticed, not acted on
- `removeDay` returns silently when the shown day has no `version` (nothing said to the person); rare.
- Any move or remove rewrites the whole day's spacing to one blank line between blocks (the person's hand spacing in other entries is normalised); Undo puts it back. Not data loss.
- Backspace paragraph join still sends a view-built `range` (known, closed as follow-up).
