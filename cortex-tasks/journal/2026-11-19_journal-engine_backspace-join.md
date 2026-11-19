---
task_name: Backspace Join As An Engine Edit
created: 2026-11-19
completed:
status: pending
categories: [journal-engine, journal-view]
type: implementation
model: strong
persona: Principal storage engineer — an edit names what the person saw and is refused, never guessed, when the file has moved on.
skills: [cortex-architecture, cortex-docs]
tracker:
---

# Task: Backspace Join As An Engine Edit

---

## Problem Statement

Backspace at the start of a paragraph joins it to the paragraph above (`bodySpec` `merge`, `src/view/specs.ts`). It still
sends a `range` the view builds from both blocks' text and an assumed single blank line between them, so a hand-spaced
file refuses it as `changed`. The last view-built byte edit outside undo (TASK-STATUS FE_01-N1, DOC_01-R1 of the Review
Fixes set).

---

## Decisions

- The user: "deal with the backspace joining two paragraphs issue. Let's get that resolved now."
- A new member of `Edit` (`src/seam-types.ts`): `{ op: 'join'; date; first: string; second: string; text: string }`.
  `first` and `second` are block keys (`Block.key`) as the view saw them; `text` is the joined writing as one paragraph,
  read from the editor (the person may have changed the second paragraph before pressing Backspace).
- The engine finds both blocks by key: missing, or `second` not straight after `first` → `409 changed`; either one not a
  paragraph, or `text` not exactly one paragraph → `400 unreadable` (`journal.problem.join`). It replaces from `first`'s start to `second`'s end with `text`, then `checked`.
- Additive to the contract; the seam stays 2.

---

## Steps

1. `src/seam-types.ts`: the `join` member, with a line comment.
2. `src/store/edits.ts`: `isEdit` accepts it; `planJoin`; `plan` dispatches it; the header comment lists it.
3. `words/words.json`: `journal.problem.join`.
4. `src/view/specs.ts` `bodySpec` `merge`: send `join` with `prev`'s and this node's keys and `r.md`; landing as now.
5. Tests: store (join; a hand-spaced pair; refusals: stale key, not adjacent, not paragraphs, text of two paragraphs;
   undo round trip); view (Backspace at the start of a paragraph sends `join`, and on a hand-spaced file the join lands).
6. `docs/specification/plugin.md`: the `join` edit in § Routes; Backspace's join out of § Not covered (now tested).

---

## Success Criteria

- `grep -rn "op: 'range'" src/view` finds nothing.
- `npm run check` clean; full `npm test` passes.

---

## Implementation Notes

**Status**: Pending
