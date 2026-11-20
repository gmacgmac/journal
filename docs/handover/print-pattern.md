# Handover to nclite: printing, as the Journal built it, and a print pattern to reuse

> Since written: nclite replaced printing with Save as PDF (`host.savePdf`, ADR-0381 on nclite's side). The Journal's
> control is now Save as PDF… (`src/view/pdf.ts`), it passes `look`, and the host draws each page's margin or band. What
> follows is the history; `docs/specification/plugin-patterns.md` § Printing (Save as PDF) is current.

> For nclite's merge with Vision Board's note, the same print pattern is set out in the shared headings in
> `docs/specification/plugin-patterns.md`, beside the calendar, the date picker, scrollbars and dialogs.

From the Journal, 2026-11-19, in answer to nclite's handover "printing in the Journal". The Journal's side is done at
commit `265c00a` (branch `print-and-polish`, github.com/gmacgmac/journal). This note says what was built, then sets out
the parts any plugin that prints can reuse, so nclite can write them up once as its print pattern, and the vision
board (and anything after it) starts from that.

## 1. What the Journal built

| Piece | Where | What it does |
|---|---|---|
| The control | `src/view/toolbar.ts` | "Print…" beside "+ Page", drawn only when `typeof host.print === 'function'`; no disabled button, no hint otherwise. Disabled while a print runs. |
| The panel | `src/view/print.ts` (`createPrint`) | Colours first (three small sample pages: black and white, the theme light, the theme dark; the choice is kept per device in `host.store`), then what to print: the day on screen, a range (two calendar picks), or everything. A choice with nothing in it reads "Nothing to print" and cannot be pressed. |
| Reading | `daysToPrint` | Reads through the Journal's own routes: a range in parts of at most 93 days, everything a batch of pages at a time; only days with writing; oldest first. |
| The element for paper | `printContent` | `<div class="journal journal-print" data-look="…">`: each day under its date heading, each entry one `section.print-item`. Every control removed; links and pictures print as their words; a to-do's box prints as ☐ / ☑. |
| The theme on paper | `printContent` | For light or dark, the host's colour properties are read from the Journal's root (`getComputedStyle`) and set on the element, and `--host-color-scheme` set to the mode chosen. nclite gives each colour as a `light-dark()` pair, so either mode prints faithfully whatever mode the app is in. |
| Paper styles | `src/view/journal.css`, `&.journal-print` | Black on white by default; the theme's page, date ink and writing for light and dark. No break inside an entry (an entry longer than a page breaks between its blocks only), none straight after a heading; days closed by a rule, never opened by one; in the theme, padding repeated on every page (`box-decoration-break: clone`). No `@page`. nclite's `checkPluginStylesheet` passes on the built CSS. |
| Calling the host | `createPrint.run` | `await host.print({ title, content })`; a rejection is said with `host.notify(…, 'error')`; a cancel says nothing; the element is let go afterwards. |
| The contract until nclite lands it | `printerOf`, `PrintAsk` in `print.ts` | The vendored `shared/plugin-host.ts` is untouched (it still matches nclite byte for byte). `PrintAsk` is nclite's proposal word for word; when nclite lands it, re-sync and take the type from the contract. The Journal stays on seam 2. |
| Tests | `tests/view/print.test.ts`, `tests/view/build.test.ts` | No control without `host.print`; each choice passes the right days and title with no controls in the content; entries grouped; colours chosen, carried and kept; "Nothing to print"; the control waits; failure said, cancel not; the stylesheet keeps nclite's at-rule and `url()` rules. |
| Dev page only | `dev/host.ts`, `dev/index.html`, `dev/dev.css` | A stand-in print window: the element alone with Print and Close. It prints from `#print-out` in the page's own flow (see 3.4). |

## 2. The print pattern: what any plugin that prints can share

These held for the Journal and are not about the Journal. They are what nclite could write up as its print pattern.

### 2.1 The contract, and who owns what

- The host owns: the print window, page size and margins, hiding the rest of the app, the shell's permissions.
- The plugin owns: the Print control, the choice of what to print, and one element built for paper.
- One call: `host.print({ title, content })`. It resolves when the window closes, printed or cancelled, and rejects
  only when printing could not start.
- Feature detection, not a version check: no `host.print`, no control at all.

### 2.2 The control and the panel

- One "Print…" control in the plugin's own toolbar. While a print runs it is disabled; a second press does nothing.
- A panel, not a dialog, under the control. **Colours first, then what to print**: choosing what to print starts the
  print at once, so every setting must come before it.
- Every choice is honest before it is pressed: one with nothing in it says "Nothing to print" and is disabled.
- Words in the plugin's words file; the panel's two sections each named (a radio group for the colours, a group for
  the choices) so a screen reader hears them.

### 2.3 Colours on paper: three looks

- **Black and white** (the default): black on white, never the host's colours.
- **Light** and **dark**: the theme's own colours on paper. The plugin copies the host's colour properties onto its
  element as the host gives them, and sets `--host-color-scheme` to the mode. This works because the host gives each
  colour as a `light-dark()` pair: a property set to one mode's value only would print that mode either way.
- The choice is a viewer's convenience, kept per device (`host.store`), and lost without harm.
- Show the looks as small sample pages drawn in their own colours, not as words alone.

### 2.4 The element for paper

- A fresh element for this print alone, class `<plugin> <plugin>-print`, with `data-look`.
- Nothing that can be pressed or focused in it: no buttons, inputs, links (print their words), menus, chips.
- Built from the plugin's data, not cloned from the screen: the screen has controls, hover states and editors in it.
- Each unit the reader thinks of as one thing (a Journal entry; for a board, perhaps a card or a column) is one element,
  so the stylesheet can keep it whole.

### 2.5 Paper styles

- Everything under the plugin's own class, inside its usual stylesheet; the host's stylesheet check still applies
  (`.plugin…` selectors only; `@media`, `@supports`, `@container`; `url()` only to `data:`; `var()` only to
  `--plugin-*` or `--host-*`). No `@page`: margins are the host's.
- `break-inside: avoid` on each unit, and on paragraphs, items, quotes and pictures inside it; `break-after: avoid` on
  headings.
- A separator closes a section, never opens one, so a section that starts a page starts clean.
- A coloured look: `box-decoration-break: clone` with padding, so every page has room at its top and foot, not only
  the first and last; `print-color-adjust: exact` so the browser keeps the colours.
- Pictures `max-width: 100%`.

### 2.6 Tests every plugin can copy

- No control without `host.print`.
- A fake `host.print` that keeps each ask: each choice passes the right title and the right content.
- The content holds no `button, input, select, textarea, a, [contenteditable], [tabindex]`.
- A rejected print is said; a resolved one (printed or cancelled) is not.
- The stylesheet keeps the host's rules (or the host's own checker is run on the build).

## 3. What nclite should decide or do

1. **Land `print` in the contract** (`shared/plugin-host.ts`) as proposed. Tell the Journal; it re-syncs
   (`npm run sync:nclite -- <nclite checkout>`) and swaps its local `PrintAsk` for the contract's. No other change.
2. **Margins for a coloured print.** The host sets page margins, so a dark print is a dark panel on white margins.
   That is fine; if edge-to-edge dark pages are wanted, the host would set zero margins when the plugin asks for a
   coloured look (for instance a `look` or `margins` member on `PrintAsk`), and the plugin would keep its own padding.
3. **Keep giving colours as `light-dark()` pairs.** Printing in the other mode depends on it (`Pane.svelte` does this
   today); worth saying in the contract's notes on `--host-*`.
4. **Print from the page's flow, not from inside a modal dialog.** In the Journal's dev stand-in, printing from inside
   a `showModal()` dialog clipped the print to what the screen showed (only a few days came out). Moving the element
   into an ordinary element of the page for the print fixed it. nclite's print window should do the same.
5. **Write the pattern down once** (section 2), in nclite's plugin docs, and point the vision board at it. Section 1
   is the worked example. A shared code package (the colours panel, the theme copying, the base paper styles) is worth
   making only when a second plugin needs the same pieces; the board's layout will differ (a board is a picture to
   fit to a page, not text that flows), so its element and paper styles are its own.

## 4. The vision board, briefly

What carries over unchanged: 2.1, 2.2, 2.3, 2.6, and the rules in 2.5. What is its own: what a print holds (the whole
board, a selection, a column?), and fitting a fixed-size picture to a page (scale to the page's width, or tile across
pages), which flowing text never needs.
