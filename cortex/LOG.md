# LOG

<!-- Append new entries below this line. No anchor or read needed — just append. -->
[[2026-11-19 14:10]] [cortex-infra] Cortex bootstrapped: PROFILE §2 nine journal-* categories, REGISTRY paths, doc surface and excludes
[[2026-11-19 14:12]] [journal-view] Start today's page hidden until today's place is pointed at, then faint → Notes: `src/view/journal.css` (`.day.gap .add-entry`) — two-strength hover rule, always faint alone in Day
[[2026-11-19 14:12]] [journal-format] Route read limits given one home → Notes: `src/format/limits.ts` (`MAX_RANGE_DAYS`, `MAX_PAGES`) — engine and print both import them
[[2026-11-19 14:12]] [journal-view] Print panel's range row uses the icon set's chevron; comments give reasons, not history; build-check test named as one → Notes: `src/view/icons.ts` (`chevron`), `tests/view/build.test.ts` (built stylesheet check)
