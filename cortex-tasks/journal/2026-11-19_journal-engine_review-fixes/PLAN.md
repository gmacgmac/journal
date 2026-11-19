# Review Fixes - Plan

> **Status Doc**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Created**: 2026-11-19
>
> One page, not counting Decisions. Rules by reference, never copied in.

---

## Problem

A review against `cortex-architecture` found three things built in the wrong layer and two left behind:
- Moving an entry, removing an entry and removing a day are built in the view as exact-byte `range` edits (`moveEdit` in `src/view/move.ts`, `emptiedEntry` and `headingSpec` `remove` in `src/view/specs.ts`, `removeDay` in `src/view/journal.ts`). They break on a hand-spaced file and are refused in undo's words.
- "A file holding only its date line is no page" lives only in the view (`hasPage`, `src/view/days.ts`); `GET pages` still counts such files.
- `src/view/journal.css` is ~570 lines, far past the ~300-line guideline (rule 2).
- `docs/specification/plugin.md` describes none of this session's behaviour; drag (`src/view/drag.ts`) has no tests.

---

## Solution

1. **Contract and format (BE_01)**: three engine edits named by entry id (`move`, `remove`, `clear`); `range` stays, for undo only. The entry rules (a day's entries, the places an entry may move to, whether a day has writing) get one home, `src/format/entries.ts`, used by engine and view.
2. **Engine (BE_01)**: plan the three edits from the file's text; `GET pages` leaves out files with no writing.
3. **View (FE_01)**: send the new edits; take the entry rules from `src/format/entries.ts`; a day removed in the running journal stays on the sheet so Undo can bring it back; drag tests.
4. **Stylesheet (FE_02)**: `journal.css` split into partials, built into one stylesheet as now.
5. **Spec (DOC_01)**: `docs/specification/plugin.md` true to the code.

---

## Decisions

- The user: "Bootstrap cortex. Go for it. And then proceed. I think that all sounds good." The six review points (engine edits, empty days in one place, spec, drag tests, stylesheet split; the `PrintAsk` copy waits for nclite) are approved.
- Planner's rulings, so no task reopens them:
  - Edits added to `Edit` (`src/seam-types.ts`): `{ op: 'move'; date; entry: string; before: string | null }` (`entry` and `before` are entry ids, a heading block's key; `before: null` is the end of the day); `{ op: 'remove'; date; entry: string }`; `{ op: 'clear'; date; version: string }` (the day's `version` the view read; leaves the date line). Additive: the seam stays 2.
  - A missing id, or a `version` that no longer matches, is `409 changed`. A move that would put a timed entry out of time order is `422 order`. A move to where it already is succeeds with the text unchanged.
  - The engine rebuilds the day as the date line, then each entry's own text (its first block's start to its last block's end), joined by one blank line, ending in `\n`.
  - `clear` keeps the file (date line only), so Undo is an ordinary `range`. `GET pages` and the view treat such a file as no page.
  - A day the person removes in the running journal stays on the sheet as a day with no page (`placed`) until the journal is drawn again.
- The user asked for delegation to sub-agents, in parallel where possible, with the orchestrator checking every result ("a chief of staff approach").

---

## Dependencies

- BE_01 creates `src/format/entries.ts` and the new `Edit` members; FE_01 consumes both, so FE_01 is wave 2.
- FE_02 (wave 1) owns every stylesheet file; FE_01 (wave 2) changes no CSS.
- DOC_01 describes the finished code: wave 3. VERIFY_01 audits everything, the doc too: wave 4.

---

## House Rules

- **Orchestrator-only files**: `package.json`, `package-lock.json`, `src/vendor/`, `cortex/PROFILE.md`, `cortex/REGISTRY.md`, `dist/`.
- **Commits**: the orchestrator commits each passed wave on branch `review-fixes`; `main` is fast-forwarded once VERIFY_01 passes.
- **Project checks**: `npm run check` (types) and the tests named in your task. Wave 1 shares one checkout: run only your own tests until your work is done, then the full `npm test` once.
- **Test time limit**: 150 s per run.

---

## Out of Scope

- New bot tools for move, remove or clear (the bot keeps `delete_block` and the rest).
- Entries with no time and no title (awaiting the user's decision).
- How hover-only controls show on phones (works today; "Remove this day" on every day on a phone is noted for the user).
- `PrintAsk` (waits for nclite's contract).
