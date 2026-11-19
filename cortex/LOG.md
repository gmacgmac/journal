# LOG

<!-- Append new entries below this line. No anchor or read needed — just append. -->
[[2026-11-19 14:10]] [cortex-infra] Cortex bootstrapped: PROFILE §2 nine journal-* categories, REGISTRY paths, doc surface and excludes
[[2026-11-19 14:12]] [journal-view] Start today's page hidden until today's place is pointed at, then faint → Notes: `src/view/journal.css` (`.day.gap .add-entry`) — two-strength hover rule, always faint alone in Day
[[2026-11-19 14:12]] [journal-format] Route read limits given one home → Notes: `src/format/limits.ts` (`MAX_RANGE_DAYS`, `MAX_PAGES`) — engine and print both import them
[[2026-11-19 14:12]] [journal-view] Print panel's range row uses the icon set's chevron; comments give reasons, not history; build-check test named as one → Notes: `src/view/icons.ts` (`chevron`), `tests/view/build.test.ts` (built stylesheet check)
[[2026-11-19 13:44]] [journal-view] Split journal.css into seven partials under src/view/css/ with an @import index; tests read the whole sheet via readStylesheet(); built sheet unchanged in rules and order → Task: [[cortex-tasks/journal/2026-11-19_journal-engine_review-fixes/FE_02_stylesheet-split.md]]
[[2026-11-19 12:00]] [journal-engine] BE_01: engine plans move/remove/clear by entry id; entry rules in src/format/entries.ts; GET pages leaves out date-line-only files; tests added, 272 pass → Task: [[cortex-tasks/journal/2026-11-19_journal-engine_review-fixes/BE_01_engine-edits.md]]
