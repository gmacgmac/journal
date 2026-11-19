# FE_01_view-edits: View on the new edits, drag tests

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Plan**: [PLAN.md](./PLAN.md)

---

## Objective

The view sends `move`, `remove` and `clear` instead of building `range` edits, takes the entry rules from `src/format/entries.ts`, keeps a removed day on the sheet so Undo brings it back, and drag has tests that drive it.

---

## Inputs

- **Files to modify**: `src/view/move.ts`, `src/view/drag.ts`, `src/view/specs.ts` (`emptiedEntry`, `headingSpec` `remove`), `src/view/journal.ts` (`removeDay`), `src/view/days.ts` (`hasPage`, `writingOf`, `patchDay` replace path), `words/words.json` (`journal.view.*` only, if a sentence is needed), tests under `tests/view/` (not the four FE_02 owned), new `tests/view/drag.test.ts`, `tests/view/fake-dom.ts`, `tests/view/fake-host.ts`.
- **Shared artifacts to reuse**: `src/format/entries.ts` (`entrySpans`, `placesFor`, `hasWriting`) and `Edit` in `src/seam-types.ts` — built by BE_01. Import them; do not re-create them. Read BE_01's notes first.
- **Files to reference**: `src/view/editor.ts` (`save`, `landing`), `src/view/session.ts` (`Spec`), `src/view/views.ts` (`patch`, `relayout`), `src/view/feed.ts` (`layout`, `placed`), `tests/view/mount.test.ts` (how a mount is driven).
- **Skills**: `cortex-architecture`.

---

## Steps

1. [x] `move.ts`: keep only what the view needs on top of format (`entryName`, `isStill`, and a `moveEditOf(date, spans, from, slot)` returning `{ op: 'move', date, entry, before }`, `before` being the id of the entry the slot is in front of, or null at the end). `drag.ts` uses `placesFor` and `moveEditOf`; `ready` builds spans with `entrySpans`.
2. [x] `specs.ts`: `headingSpec` `remove` and `emptiedEntry` send `{ op: 'remove', date, entry: <heading's key> }`. The landing after a removal stays as now.
3. [x] `journal.ts` `removeDay`: send `{ op: 'clear', date, version: day.version }` (a day with a null version cannot be cleared: do nothing). Before patching, mark the section `placed`; in `days.ts` `patchDay`, when a section is replaced, carry `placed` onto the new one, so the running journal keeps the day as one with no page and Undo's patch finds it.
4. [x] `days.ts`: `hasPage` and `writingOf` use `hasWriting` / `entrySpans` from format (one rule, two callers); keep their names so callers do not change.
5. [x] `tests/view/move.test.ts`: test `moveEditOf` (the rules themselves are now tested in `tests/format.test.ts`); drop cases BE_01 moved.
6. [x] `tests/view/drag.test.ts` (drive it as a person would, through the mount): keys — focus a handle, Space lifts (announced), ↓ moves (announced), Enter drops and the `move` edit sent names the right ids; Escape puts it back and sends nothing; focus leaving cancels. Pointer — pointerdown + a move past 4px lifts; Escape cancels and a later move does not lift again; a move with `buttons: 0` cancels; `lostpointercapture` cancels; unmount mid-lift leaves no ghost, line or listeners. Timed entries have no handle. Extend `fake-dom.ts` only as far as these need (pointer events, `setPointerCapture`).
7. [x] Existing mount tests for removing a day and emptying an entry assert the new ops; add: remove a day in the running journal, then Undo, and the day is back with its entries.

---

## Validation

- [x] `npm run check` clean; `node --test tests/view/` passes; full `npm test` passes.
- [x] `grep -n "op: 'range'" src/view` shows only undo (`undo.ts`) and the to-do tick if it uses one — report any other.

---

## Implementation Notes

**Status**: Completed  
**Completed**: 2026-11-19

### Changes Made
- `move.ts`: only `isStill`, `entryName` and `moveEditOf(date, spans, from, slot)` (`{ op: 'move', date, entry, before }`, `before` null at the end). `drag.ts` uses `entrySpans`, `placesFor` (format) and `moveEditOf`; ids are `EntrySpan.id`.
- `specs.ts`: `emptiedEntry` and `headingSpec` `remove` send `{ op: 'remove', date, entry }`. The body spec's `landing` knows a `remove` has no `start` and lands at the heading's old start, as before. `editor.ts` `save`: the toast says "deleted" for a `remove` edit too (it read `after === ''`, which a remove no longer has).
- `journal.ts` `removeDay`: sends `{ op: 'clear', date, version }` (nothing when the version is null); marks the section `placed` first, and takes the mark off again if the engine refuses and the day still has its page. `days.ts` `patchDay` carries `placed` onto a replaced section; `hasPage` uses `hasWriting`; `writingOf` typed `Block[]`.
- `tests/view/fake-host.ts` (BE_01-R1): `save` now runs the engine's own `plan` and `undoOf` (imported from `src/store`), answers with the engine's `word` text and status, and gives each existing day its real `version`. No re-implementation.
- `tests/view/fake-dom.ts`: `setPointerCapture`/`releasePointerCapture`; selectors take descendant and child combinators (`:scope .entries > .block:not(.draft)`) and quoted values with spaces.
- Tests: `move.test.ts` (the edit), new `drag.test.ts` (16: keys, pointer, window blur, unmount mid-lift; layout stubbed to stack blocks 40px apart), new `remove.test.ts` (remove an entry, empty an entry, hand-spaced file, clear a day then Undo, refused clear).

### Issues & Resolutions
- Existing mount tests did not cover removing a day or emptying an entry, so the new ops are asserted in the new `remove.test.ts` rather than edited in `mount.test.ts`.
- Node has no `DOMRect` or `requestAnimationFrame`; `drag.test.ts` sets them for its own run and restores them.

### Caught Beyond the Brief
- The "deleted" toast label depended on `edit.after === ''`; fixed above.
- `grep "op: 'range'" src/view` still shows `specs.ts` (Backspace merging two paragraphs: `merge`) besides undo, which is an exact-bytes edit of text the view just read; not changed (not a move, remove or clear).

### Deviations from Plan
- None.
