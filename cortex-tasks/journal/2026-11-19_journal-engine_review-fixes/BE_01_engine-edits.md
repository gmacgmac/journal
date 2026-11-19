# BE_01_engine-edits: Engine edits and entry rules

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Plan**: [PLAN.md](./PLAN.md)

---

## Objective

The engine plans `move`, `remove` and `clear` edits by entry id, the entry rules have one home in `src/format/entries.ts`, and `GET pages` leaves out files with no writing.

---

## Inputs

- **Files to modify**: `src/seam-types.ts` (`Edit`), new `src/format/entries.ts`, `src/format/index.ts`, `src/format/day.ts` (`entriesOf`), `src/store/edits.ts` (`plan`, `isEdit`, `RefusalCode`), `src/engine/days.ts` (`readPages`), `src/engine/tools/write.ts` (`storeRefusal`, only to cover the new code), `words/words.json` (engine `journal.problem.*` keys only), tests: `tests/format.test.ts`, `tests/store.test.ts`, `tests/routes.test.ts`.
- **Files to reference**: `src/view/move.ts` (`entriesOfDay`, `slotsFor`: the rules to move into format, as they are), `src/view/days.ts` (`hasPage`, `writingOf`), `tests/view/move.test.ts` (cases to mirror), `src/engine/routes.ts` (`edit`), `src/store/store.ts` (`planEdit`, `version`).
- **Skills**: `cortex-architecture`.

---

## Steps

1. [ ] `src/format/entries.ts`: `EntryBlock` (`{ key; start; end; text }`), `EntrySpan<B>` (`id`, `time`, `title`, `blocks`), `entrySpans(blocks)` (groups from the first entry heading on; blocks before it, the date line, are left out), `placesFor(spans, from)` (exactly `slotsFor`'s rule: 0..n, `from` and `from + 1` always given, a timed entry only between its timed neighbours), `hasWriting(blocks)` (any block other than a leading `# ` date line). Export from `src/format/index.ts`. Rebuild `entriesOf` (`day.ts`) on `entrySpans`, so one function decides what an entry is.
2. [ ] `Edit` in `src/seam-types.ts`: add the three members exactly as PLAN.md § Decisions words them, each with a one-line doc comment; say `range` is how an undo is applied.
3. [ ] `src/store/edits.ts`: `isEdit` accepts them (strings checked; `before` string or null). `plan` dispatches to `planMove`, `planRemove`, `planClear`. Rebuild the day as PLAN.md says (date line, each entry's own text from its first block's start to its last block's end, one blank line between, ending `\n`) so a hand-spaced file works; then `checked(...)`. Refusals: unknown id → `409 changed`; `clear` with a `version` other than `version(text)` → `409 changed`; a move `placesFor` does not allow → `422`, new `RefusalCode` `order`, words key `journal.problem.entry-order` ("That entry has a time: it stays in time order. Change its time to move it."). `version` lives in `src/store/store.ts`; import it, do not copy it. Update the file's header comment, which lists the edits.
4. [ ] `src/engine/tools/write.ts` `storeRefusal`: add the `order` case so the switch stays exhaustive (the bot cannot send these edits; map it like `heading`).
5. [ ] `src/engine/days.ts` `readPages`: a file whose text has no writing (`hasWriting(keyedBlocks(text))`) is not a page; `next` still works when such files are skipped.
6. [ ] Tests (behaviour, run them): format: `entrySpans`, `placesFor` (mirror `tests/view/move.test.ts`), `hasWriting`; store: each edit, each refusal, a hand-spaced file (two blank lines between blocks) moved and removed, undo of each round-trips via `undoOf` + `plan` `range`; routes: `POST edit` with each new op, and `GET pages` skipping a date-line-only file.

---

## Validation

- [ ] `npm run check` clean.
- [ ] `node --test tests/format.test.ts tests/store.test.ts tests/routes.test.ts tests/tools.test.ts` all pass; then the full `npm test` once at the end (wave 1 shares the checkout: a view CSS test failing mid-split is FE_02's, not yours — note it).

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
