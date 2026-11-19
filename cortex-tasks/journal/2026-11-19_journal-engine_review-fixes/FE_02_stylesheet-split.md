# FE_02_stylesheet-split: Split the stylesheet

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md) · **Plan**: [PLAN.md](./PLAN.md)

**Objective**: `src/view/journal.css` becomes an index of `@import`s of partials in `src/view/css/`, each under ~200 lines, built into the same single `view/journal.css`, with every test reading the whole sheet.

**Files to modify**: `src/view/journal.css`, new `src/view/css/*.css`, `tests/view/css.ts`, `tests/view/colours.test.ts`, `tests/view/touch.test.ts`, `tests/view/focus.test.ts`. Read only: `vite.config.ts`, `bin/scope-css.ts`, `dev/server.ts`, `tests/view/build.test.ts`.

**Steps**
1. Cut at the file's own section headings (the `/* ─── … */` lines), keeping order exactly (the cascade depends on it): `css/root.css` (from the top, the header comment and `.journal {` with its tokens, through the toolbar rules, up to "The open journal"), `css/sheet.css` (The open journal), `css/writing.css` (Writing in place), `css/drag.css` (Moving an entry), `css/bar.css` (The writing bar and the toast), `css/phone.css` (Phone), `css/print.css` (For paper) plus the closing `@keyframes journal-fresh` at top level. Each partial except `root.css` wraps its rules in its own `.journal { … }`. Move comments with their rules; change no rule.
2. `src/view/journal.css`: a short header comment (one sheet, built from these parts, in this order, and why the order matters) and the seven `@import url('./css/….css');` lines in order. Vite inlines them in both the build and the dev page.
3. `tests/view/css.ts`: add `readStylesheet()` — reads `src/view/journal.css` and inlines each `@import` from `src/view/` in order, returns the text. Use it in `colours.test.ts`, `touch.test.ts`, `focus.test.ts` instead of reading `journal.css` directly.
4. If a partial passes ~200 lines, split it again at a heading.

**Validation**: `npm run check`; `node --test tests/view/colours.test.ts tests/view/touch.test.ts tests/view/focus.test.ts tests/view/build.test.ts tests/build.test.ts` pass; `npm run build:plugin` then `grep -c '@import' dist/plugin/journal/view/journal.css` prints 0; the built sheet's rule count matches before and after (count `{` in the built file before you start, and after). Then the full `npm test` once.

**Rules**: PLAN.md House Rules; touch only these files; no git state changes; notes below on completion.

## Implementation Notes
**Status**: Pending
