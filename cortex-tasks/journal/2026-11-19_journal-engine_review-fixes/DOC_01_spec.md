# DOC_01_spec: Spec true to the code

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Plan**: [PLAN.md](./PLAN.md)

---

## Objective

`docs/specification/plugin.md` (and any untrue claim in `README.md` or `skill/SKILL.md`) describes the code as it now is, each claim held to a symbol and a test.

---

## Inputs

- **Files to modify**: `docs/specification/plugin.md`; `README.md` and `skill/SKILL.md` only where a sentence is now untrue.
- **Files to reference**: `git log --oneline -12` and `git diff 54c1d25..HEAD -- src words` (everything since the spec was last true); `docs/handover/print-pattern.md` (print, already written up); BE_01 and FE_01 notes in TASK-STATUS.md.
- **Skills**: `cortex-docs` (follow it: claims tied to a symbol and a named test; destination from REGISTRY `docs`).

---

## Steps

1. [ ] Routes: the `Edit` members (`move`, `remove`, `clear`; `range` for undo), their refusals (`changed`, `order`), the rebuilt spacing; `GET pages` skips a file with only its date line.
2. [ ] The data: entries keep time order when a heading's time changes (engine and bot); a title cannot start like a block (`BLOCKISH_RE`).
3. [ ] The view: the writing's inks a step lighter and the controls in the host's own; hover controls at two strengths, and how they show with no hover; the foot of a day (+ Entry / + Entry with time) and untimed drafts; Start today's page; Remove this day (`host.confirm`, one undo); drag (untimed entries only; keys); an emptied untitled entry goes with its time; `> ` continues a quote; quotes upright.
4. [ ] Print: `host.print` (optional; no control without it), the panel, the three looks, the paper rules; point to `docs/handover/print-pattern.md` rather than repeating it.
5. [ ] The view's use of `host.confirm` (no longer only from `leave()`).
6. [ ] Run the `cortex-docs` audit on what you changed; list each claim's symbol and test in your notes.

---

## Validation

- [ ] Every claim you add names the symbol it describes; each symbol exists (`grep`).
- [ ] No claim about code you did not check.

---

## Implementation Notes

**Status**: Completed  
**Completed**: 2026-11-19

### Changes Made
- `docs/specification/plugin.md`, by section: § The data (entry rules' home `src/format/entries.ts`: `entrySpans`, `placesFor`, `hasWriting`; time order kept when a time changes, `inTimeOrder` / `landedHeading`; `BLOCKISH_RE`; a date-line-only file is no page); § Routes (`GET pages` skips such a file, `readPages`; `Edit` with `move`, `remove`, `clear`, `order`, the rebuilt spacing, `planMove`/`planRemove`/`planClear`/`rebuilt`/`isEdit`); § Tools (`replace_block` heading time); § The view (Start today's page, `hasPage`, foot of a day `addZone`, untimed drafts, Remove this day `removeDay`, removing an entry, drag `createDrag`/`moveEditOf`, Print `createPrint`/`printerOf` pointing to `docs/handover/print-pattern.md`, hover strengths, `> `, quotes upright, Backspace join as a view-built `range` (FE_01-N1), host table rows `confirm`, `print`, `api`); § The look (partials and `@import` index, the inks a step lighter, `--journal-chrome-*`, `--journal-app-*`, contrast); § Not covered.
- `README.md`: the stylesheet is an index of `src/view/css/` partials.
- Symbols (all grepped): `entrySpans`, `placesFor`, `hasWriting`, `entriesOf` (`src/format/entries.ts`); `plan`, `planMove`, `planRemove`, `planClear`, `rebuilt`, `inTimeOrder`, `isEdit` (`src/store/edits.ts`); `readPages` (`src/engine/days.ts`); `storeRefusal`, `landedHeading` (`src/engine/tools/write.ts`); `hasPage`, `addZone` (`src/view/days.ts`); `removeDay` (`src/view/journal.ts`); `headingSpec`, `bodySpec`, `emptiedEntry`, `BLOCKISH_RE`, `headingMarkdown` (`src/view/specs.ts`); `createDrag` (`drag.ts`), `moveEditOf` (`move.ts`), `createPrint`, `printerOf`, `PrintAsk`, `daysToPrint`, `printContent` (`print.ts`); `convert` (`editor-keys.ts`); `readStylesheet` (`tests/view/css.ts`).
- Tests cited (each exists, grepped): `tests/format.test.ts` (entrySpans, entriesOf, places, hasWriting); `tests/store.test.ts` (time order, move/remove/clear, hand-spaced, applied through the store); `tests/routes.test.ts` (move/remove/clear route, date-line-only pages); `tests/tools.test.ts` (heading later time); `tests/view/remove.test.ts`, `drag.test.ts`, `move.test.ts`, `days.test.ts`, `dom-tree.test.ts`, `print.test.ts`, `build.test.ts`, `touch.test.ts`, `mount.test.ts`, `colours.test.ts`.

### Caught Beyond the Brief
- Spec's `entriesOf` path was `src/format/day.ts`; now `src/format/entries.ts`.
- Spec said the stylesheet had no `@import` of its source; the source is now an `@import` index and the built sheet has none.
- Token table inks were the host's directly; now mixed 12% white, with new chrome and app tokens.
- Stray `src/view/css/-c1-40.css` (two lines, an empty `.journal {}`) is imported nowhere in the index; FE_02's, not mine.

### Deviations from Plan
- Claims with no test are listed under § Not covered, not tested (no code or tests may change here): hover strengths and no-hover display, Start this page unseen, quotes upright, `> ` continuing a quote, Backspace's `range` join (FE_01-N1), print on paper. `SKILL.md` left alone: no sentence in it is untrue.
