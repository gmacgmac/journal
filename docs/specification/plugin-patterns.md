# Plugin patterns: what the Journal built, for nclite to own

From the Journal, 2026-11-19. Vision Board writes the same note; nclite merges both. This describes what we built so the
host can provide it once. It is not code to copy. Paths are in this repo; `docs/handover/print-pattern.md` has more on print.

## Dates and times (one format for every plugin)

- **A day** is `YYYY-MM-DD`, a calendar day with no time zone (a "floating" date). Checked by `isDate`, `src/format/dates.ts`.
- **Day arithmetic** (`addDays`, `daysBetween`) is done in UTC, so a time zone or a clock change never moves a day.
- **Today** is the day on the person's own clock where the engine runs (`localToday`), never UTC's day.
- **A time** is `HH:MM`, 24-hour, minute precision, the person's local wall clock, no zone or offset (`TIME_RE`,
  `src/format/day.ts`). Typed `9:30` is stored `09:30`. "Now" is `timeNow`, `src/view/specs.ts`.
- **Accepted**: only these two forms, at the routes (`isDate`) and in the bot's tools (the `time` pattern in
  `src/engine/tools/schemas.ts`). Anything else is refused, never guessed.
- **Shown**: `Saturday 7 November 2026` (`dateTitle`) and `Sat 7 Nov` (`shortDate`, `src/view/dates.ts`), from our own
  English tables; the calendar's month and weekday names come from `Intl`, en-GB.
- **Ask of nclite**: one shared definition: floating `YYYY-MM-DD` days, local `HH:MM` times, and when a plugin needs an
  instant, ISO 8601 with offset. Plus the person's locale and first day of the week as host settings.

## Printing

1. **The need.** A person prints some of a plugin's content, or saves it as a PDF, in plain or themed colours.
2. **What we built.** `src/view/print.ts`: `createPrint` (the Print… panel), `daysToPrint`, `printContent` (a fresh
   element for paper, no controls), `printerOf`. Paper styles in `src/view/css/print.css`. Tests: `tests/view/print.test.ts`.
3. **What the host should provide.** A hook `print({ title, content, look, orientation }) → Promise<void>` (every member
   optional; nclite's contract has it): resolves when the window closes (printed or cancelled), rejects only if printing
   cannot start. The host owns `@page`: plain gets a 10 mm margin, light and dark go edge to edge. It also owns hiding the
   app, and the window.
4. **How a plugin uses it.** Feature-detect `host.print`. Build its own element, `<plugin> <plugin>-print`, with
   `data-look`, and pass the same `look`. In light or dark it pads its own content (the margin is now its own). Call the
   hook; disable its control meanwhile; say a rejection with `host.notify`. The plugin still chooses what to print and how
   it lays out.
5. **Fallback.** No hook: draw no Print control at all. No disabled button, no hint.
6. **Versioning.** Optional member, feature-detected; new options are optional fields on the ask, ignored when unknown.
7. **Pitfalls found.**
   - Printing from inside a modal `<dialog>` clipped the print to the screen. Print from the page's own flow.
   - Browsers drop backgrounds: `print-color-adjust: exact`.
   - Dark mode: never use host colours for the plain look. For a themed look, copy the host's colours onto the element and
     set `color-scheme`. This only works because nclite gives colours as `light-dark()` pairs.
   - A base `color-scheme: light` on the print element silently overrode the dark look.
   - An entry split across pages: `break-inside: avoid` on each unit; `break-after: avoid` on headings.
   - Padding only on the first and last page. `box-decoration-break: clone` fixes it in Chrome but not in WebKit (the
     desktop shell). What holds in both: each unit (a day, an entry) carries the page band as padding and gives it back as
     negative margin, so a break between units leaves the band on both pages.
   - A rule above each section printed alone at a page top: close sections with the rule instead.
   - Edge to edge, the last page was white below the writing: an element's background ends with its content. A
     `position: fixed` box behind it (print only) is repeated on every printed page, so every page wears the ground.
   - We print no icons, so we did not meet SVG strokes printing as filled shapes. Vision Board did; their fix should stand.
8. **Open questions.** Will `light-dark()` pairs be part of the contract? Should the host paint the page's ground for light
   and dark itself, so each plugin needn't (the fixed box above)?

## The calendar (a month to pick a day from)

1. **The need.** Pick one day from a month, and see which days already have something.
2. **What we built.** A dependency-free package, `src/ui/date-pick/` (own README and tests, `tests/ui/date-pick.test.ts`):
   `createCalendar` is the WAI-ARIA date-picker grid (arrows by day and week, Home/End, Page Up/Down by month, Shift by
   year), with `min`, `max`, `today`, `value`, `weekStart`, and `mark(dates)` for dots. The Journal's use: `createDayPicker`,
   `src/view/day-picker.ts`, dots for days with a page, read a month at a time.
3. **What the host should provide.** Ideally the package itself, as a host component: `host.ui.calendar({ value, min, max,
   marked, onPick }) → element`. At least the tokens it reads, from the host's theme: `--dp-surface`, `--dp-ink`,
   `--dp-muted`, `--dp-line`, `--dp-hover`, `--dp-accent`, `--dp-fill`, `--dp-on-fill`, `--dp-ring`, `--dp-radius`, `--dp-font`.
   Plus locale and first day of the week (§ Dates).
4. **How a plugin uses it.** Pass its own words (`labels`), its range and its marked days. It still decides what a pick does.
5. **Fallback.** No host calendar: ship the package (as the Journal does today). No host tokens: the package falls back to
   system colours (`Canvas`, `Highlight`).
6. **Versioning.** Options are an object; new ones are optional. Tokens only gain names; a missing one has a fallback.
7. **Pitfalls found.** All words come from the plugin (no strings inside the package). Dates in UTC so a zone never moves a
   day. The host's stylesheet rule (every selector under `.journal`) was met by nesting the package's CSS at build
   (`bin/scope-css.ts`).
8. **Open questions.** Does nclite want to own the calendar as a component, or only its tokens?

## The date picker (asking for a day, under a button)

1. **The need.** A button asks "which day?" and shows its answer in a small panel, then gets out of the way.
2. **What we built.** In the same package: `openPopover` (placed under its anchor, or over it when there is more room,
   held inside a boundary; closes on Escape, a press outside, focus leaving, or its scroller scrolling; focus returns to
   the anchor; `aria-expanded`, `aria-controls`; placed through the CSSOM so a strict CSP allows it) and `createDayStrip`
   (a short run of days as buttons). The Journal's Print panel reuses the same popover (`panel`, `src/view/day-picker.ts`).
3. **What the host should provide.** A popover primitive, `host.ui.popover({ anchor, content, label, align }) → { close }`,
   so every plugin's menus and pickers place, close and return focus the same way.
4. **How a plugin uses it.** It supplies the content and the label; a second press on its own button closes it.
5. **Fallback.** No host popover: the package's own.
6. **Versioning.** As the calendar: optional options, a handle that only gains methods.
7. **Pitfalls found.** A panel opening past the pane's right edge: align it `end` and hold it inside the boundary. A panel
   left open while its anchor scrolled away: close on the scroller's scroll.
8. **Open questions.** One popover for all plugins, or the native `popover` attribute once the shell supports it?

## Scrollbars

1. **The need.** Every scrolling area looks the same as the app's: a thin overlay thumb, not the system bar.
2. **What we built.** Nothing in the plugin. nclite installs its overlay scrollbar once for the whole document
   (`installOverlayScroll`), so the Journal's paper and panels already wear it. Our dev page copies it unchanged
   (`dev/overlay-scroll/`) only to look the same.
3. **What the host should provide.** What it does today, written into the contract: plugins inside the host get the
   overlay scrollbar, and `data-overlay-off` opts an area out.
4. **How a plugin uses it.** Nothing to call. Don't style scrollbars.
5. **Fallback.** Native scrollbars.
6. **Versioning.** None needed: no API.
7. **Pitfalls found.** A plugin that drew its own would show two thumbs.
8. **Open questions.** None.

## Dialogs (asking before something is taken away)

1. **The need.** Ask "are you sure?" before a destructive step, in the app's own style.
2. **What we built.** The Journal draws no dialog. It calls `host.confirm({ heading, body, confirm })` before Remove this
   day (`removeDay`, `src/view/journal.ts`) and when leaving unsaved writing (`src/view/leave.ts`). Every removal also has
   Undo, so the confirm is for the large ones only.
3. **What the host should provide.** `confirm` as today. It works well.
4. **How a plugin uses it.** Words from its own words file; act only on `true`.
5. **Fallback.** `confirm` is required in the contract today; if it became optional, a plugin would offer Undo instead.
6. **Versioning.** New optional fields on the ask, as its `list` already is.
7. **Pitfalls found.** None.
8. **Open questions.** Should the confirm say "can be undone" itself, so plugins don't word it differently?

## File save and open

The Journal has neither: its data is day files the engine owns. We have nothing to add here.
