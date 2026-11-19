---
task_name: Fable Review Findings
created: 2026-11-19
completed: 2026-11-19
status: completed
categories: [journal-engine, journal-format, journal-view, journal-contract]
type: implementation
model: strong
persona: Principal storage engineer — an edit names what the person saw and is refused, never guessed, when the file has moved on.
skills: [cortex-architecture, cortex-docs]
tracker:
---

# Task: Fable Review Findings

## Problem Statement

Fable's review of 9f75336..d93e7ef found that `remove` (and `move`) check only that an entry's id exists, so writing the
bot adds to an entry after the person opened it is removed unseen, and an id can come to name another entry with the same
heading. Plus: spec counts, an invisible focusable Remove on no-hover devices, `GET pages` promising pages that are not
there, `join` refused with the wrong status, three block shapes, time order in three places, a bot sentence that would be
wrong, and CSS-source tests not named as such.

## Decisions

- The user: "Fix all Fable's findings."
- `move` and `remove` gain `blocks: string[]`: the keys of the entry's blocks, heading first, as the view saw them. The
  engine refuses `409 changed` unless the entry named by `entry` holds exactly those blocks.
- `join` refusals for a well-formed edit are `422 join`, with the day; `text` is the editor's writing on purpose (the
  second paragraph may have been changed before Backspace), written down in the spec.
- One timed entry to a time (as `planEntry` already refuses): time order is strict. `inOrder` and `timePlace` in
  `src/format/entries.ts` are the one home; `placesFor`, `planEntry` and `inTimeOrder` use them. A retime now rebuilds the
  day's spacing as `move` does.
- `KeyedBlock` carries `kind`; `EntryBlock` is a `Pick` of it; `entrySpansOf(text)` is shared by `entriesOf` and the planner.
- `GET pages` gives `next` only when an older page with writing exists.
- The bot can never send `move`, `remove`, `clear` or `join`; `storeRefusal` maps their codes to `stale` and `input`,
  whose sentences hold.
- On a no-hover device a focused Remove this day shows.
- Tests that read stylesheet text say so in their names (rule 18).

## Steps

1. Failing tests first (rule 11): `remove` and `move` of an entry the file has added to since; three same-heading entries
   with one removed elsewhere.
2. Engine and format as the Decisions say; view sends `blocks` (`src/view/specs.ts`, `src/view/move.ts`).
3. `join` 422; `readPages`; `storeRefusal`; the focus rule in `src/view/css/sheet.css`; test names.
4. Spec: four named edits, the new fields and refusals, strict time order, the retime's spacing.
5. Full gates; LOG; commit.

## Implementation Notes

**Status**: Completed
**Completed**: 2026-11-19

### Changes Made
- `move` and `remove` carry `blocks`; `seenIndex` (`src/store/edits.ts`) refuses `409 changed` unless the entry holds exactly
  what was seen. View: `removeSeen` (`src/view/specs.ts`), `moveEditOf` (`src/view/move.ts`). Failing tests first:
  `tests/store.test.ts` "remove and move name the entry as it was seen…", then `tests/routes.test.ts`, and
  `tests/view/remove.test.ts` "an entry the bot has added to since the person saw it is not removed…".
- One home: `KeyedBlock` carries `kind`; `EntryBlock` is a `Pick` of it; `entrySpansOf`, `inOrder`, `timePlace` in
  `src/format/entries.ts`, used by `placesFor`, `planEntry`, `inTimeOrder`. Time order strict. `planJoin` parses once.
- `join` refusals `422 join` with the day; good and refused joins through the route.
- `readPages`: `next` only past a real older page (test in `tests/routes.test.ts`).
- `storeRefusal`: `order` → `stale`, `join` → `input`.
- `src/view/css/sheet.css`: a focused Remove this day shows on no-hover devices.
- Stylesheet-source tests say so in their names (touch, colours, focus).
- `docs/specification/plugin.md`: four named edits, `blocks`, `422 join`, strict order, retime rebuild, `next`, focus.

### Caught Beyond the Brief
- A retime now rebuilds the day's spacing, as `move` does (one rule for both); recorded in the spec.

### Deviations from Plan
- None. LOG timestamps that Fable saw out of order are left: LOG is append-only.
