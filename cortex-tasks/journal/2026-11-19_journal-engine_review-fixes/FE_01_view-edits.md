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

1. [ ] `move.ts`: keep only what the view needs on top of format (`entryName`, `isStill`, and a `moveEditOf(date, spans, from, slot)` returning `{ op: 'move', date, entry, before }`, `before` being the id of the entry the slot is in front of, or null at the end). `drag.ts` uses `placesFor` and `moveEditOf`; `ready` builds spans with `entrySpans`.
2. [ ] `specs.ts`: `headingSpec` `remove` and `emptiedEntry` send `{ op: 'remove', date, entry: <heading's key> }`. The landing after a removal stays as now.
3. [ ] `journal.ts` `removeDay`: send `{ op: 'clear', date, version: day.version }` (a day with a null version cannot be cleared: do nothing). Before patching, mark the section `placed`; in `days.ts` `patchDay`, when a section is replaced, carry `placed` onto the new one, so the running journal keeps the day as one with no page and Undo's patch finds it.
4. [ ] `days.ts`: `hasPage` and `writingOf` use `hasWriting` / `entrySpans` from format (one rule, two callers); keep their names so callers do not change.
5. [ ] `tests/view/move.test.ts`: test `moveEditOf` (the rules themselves are now tested in `tests/format.test.ts`); drop cases BE_01 moved.
6. [ ] `tests/view/drag.test.ts` (drive it as a person would, through the mount): keys — focus a handle, Space lifts (announced), ↓ moves (announced), Enter drops and the `move` edit sent names the right ids; Escape puts it back and sends nothing; focus leaving cancels. Pointer — pointerdown + a move past 4px lifts; Escape cancels and a later move does not lift again; a move with `buttons: 0` cancels; `lostpointercapture` cancels; unmount mid-lift leaves no ghost, line or listeners. Timed entries have no handle. Extend `fake-dom.ts` only as far as these need (pointer events, `setPointerCapture`).
7. [ ] Existing mount tests for removing a day and emptying an entry assert the new ops; add: remove a day in the running journal, then Undo, and the day is back with its entries.

---

## Validation

- [ ] `npm run check` clean; `node --test tests/view/` passes; full `npm test` passes.
- [ ] `grep -n "op: 'range'" src/view` shows only undo (`undo.ts`) and the to-do tick if it uses one — report any other.

---

## Implementation Notes

**Status**: Pending  
**Completed**: 

### Changes Made
- 

### Issues & Resolutions
- 

### Caught Beyond the Brief
- 

### Deviations from Plan
- 
