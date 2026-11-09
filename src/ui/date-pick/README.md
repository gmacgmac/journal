# date-pick

Three small parts to ask a person for a day: a **popover** to hold them, a **month calendar**, and a **day strip** for a
short span. Plain DOM and TypeScript, no dependencies, nothing imported from outside this folder: copy the folder into
another app and it works. Days are `YYYY-MM-DD` strings throughout, worked out in UTC so a time zone never moves a day.

Proven by `tests/ui/date-pick.test.ts` (in the Journal repo), which uses the package exactly as another app would.

## Use

```ts
import { createCalendar, createDayStrip, openPopover } from './date-pick/index.ts';
import './date-pick/date-pick.css';

const cal = createCalendar({
	value: '2026-11-09', max: '2026-11-09', locale: 'en-GB',
	labels: { prev: 'Previous month', next: 'Next month', marked: 'has a page' },
	onPick(date) { popover.close('pick'); open(date); },
	onMonth(first, last) { loadDaysWithPages(first, last).then((dates) => cal.mark(dates)); },
});
const popover = openPopover({ anchor: button, content: cal.el, boundary: pane, align: 'end', label: 'Which day?' });
cal.focus();
```

A second press on the button that opened a popover is the caller's to handle: close it with `close('toggle')`.

## The parts

| Part | Gives | Notes |
|---|---|---|
| `openPopover(options)` | `{ el, open, close(reason?), place() }` | Placed under its `anchor` (over it when there is more room there), held inside `boundary`, which must be a positioned element. Closes on Escape, a press outside, focus leaving it, or its `scroller` scrolling (the anchor would move away from it); `onClose(reason)` says which (`pick`, `escape`, `outside`, `toggle`, `api`). Focus goes back to the anchor after Escape or a toggle, never after a press elsewhere. The anchor carries `aria-expanded` and `aria-controls`. Positions go through the CSSOM, which a strict content security policy allows. |
| `createCalendar(options)` | `{ el, month, focus(), mark(dates) }` | The WAI-ARIA date picker grid: one day in the tab order; arrows by a day and a week; Home and End to the week's ends; Page Up and Page Down by a month, with Shift by a year. `min` and `max` hold every move; a day outside them cannot be picked. `today` carries `aria-current="date"`, the `value` `aria-pressed`. `weekStart` 0–6 (Monday by default). `onMonth(first, last)` is said for every month shown, so the caller can `mark` its days. |
| `createDayStrip(options)` | `{ el, focus() }` | A group of day buttons for a short span, in the order given; arrows move between them. `short` sets what a button shows (weekday and day by default); its accessible name is always the whole date. With `onMore` and `labels.more`, a last button offers another day. |

**Words.** Month and weekday names come from `Intl` for `locale`. Every other word (the step buttons, the marked
suffix, the group's name, "Other day…", the popover's name) is passed in through `labels` or `label`, so the package has
no words of its own and fits any app's words file.

## Theming

`date-pick.css` styles only its own `dp-` classes and reads these tokens; each has a plain system-colour fallback.

| Token | For |
|---|---|
| `--dp-surface` | The panel |
| `--dp-ink`, `--dp-muted` | Text, and weekday names and days out of range |
| `--dp-line`, `--dp-hover` | The panel's and the chips' borders, and a hovered button |
| `--dp-accent` | Today's ring and the dots of marked days |
| `--dp-fill`, `--dp-on-fill` | The chosen day |
| `--dp-ring` | The keyboard focus ring |
| `--dp-radius`, `--dp-font` | Corners and face |

**An app whose styles must sit under one class** (a plugin in a host that checks its stylesheet) nests the file inside
that class at build time. The Journal does it with a small Vite plugin, `bin/scope-css.ts`, which wraps every `.css`
under `src/ui/` as `.journal { … }`.
