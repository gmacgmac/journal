// The Journal's way to ask for a day, over the date-pick package (`src/ui/date-pick/`): a month calendar for Add a page
// and Day's date, and a strip of the days in a gap between pages. One panel at a time per mount, inside the view's root;
// a second press on the button that opened it closes it. The calendar dots the days that have a page, read a month at a
// time through the Journal's own route. The package takes every word from here (`words.json`).
import { createCalendar, createDayStrip, openPopover, type Popover } from '../ui/date-pick/index.ts';
import { addDays, daysBetween } from '../format/index.ts';
import type { Routes } from './wire.ts';
import { say } from './words.ts';

/** The days a gap's strip offers before it offers another day from the calendar. */
export const STRIP_DAYS = 7;
/** The names of months and weekdays, as the Journal's dates are written. */
const LOCALE = 'en-GB';

export interface CalendarAsk {
	value: string;
	min?: string;
	max?: string;
	align: 'start' | 'end' | 'center';
	onPick(date: string): void;
}

export interface DayPicker {
	calendar(anchor: HTMLElement, ask: CalendarAsk): void;
	/** The days `from`..`to` (a gap), newest first, `STRIP_DAYS` at most, then the calendar for the rest. */
	strip(anchor: HTMLElement, from: string, to: string, onPick: (date: string) => void): void;
	close(): void;
}

export function createDayPicker(boundary: HTMLElement, scroller: HTMLElement, routes: Routes, today: () => string): DayPicker {
	let open: { popover: Popover; anchor: HTMLElement } | null = null;

	/** Closes what is open; true when it was opened by `anchor` (a press on its own button only closes it). */
	function toggled(anchor: HTMLElement): boolean {
		if (open === null || !open.popover.open) return false;
		const same = open.anchor === anchor;
		open.popover.close(same ? 'toggle' : 'api');
		return same;
	}

	function show(anchor: HTMLElement, content: HTMLElement, align: CalendarAsk['align'], focus: () => void): Popover {
		const popover = openPopover({ anchor, content, boundary, scroller, align, label: say('journal.view.add.pick'), className: 'journal-dp' });
		open = { popover, anchor };
		focus();
		return popover;
	}

	function calendar(anchor: HTMLElement, ask: CalendarAsk): void {
		if (toggled(anchor)) return;
		let popover: Popover | null = null;
		const cal = createCalendar({
			value: ask.value, min: ask.min, max: ask.max, today: today(), locale: LOCALE,
			labels: { prev: say('journal.view.pick.prev'), next: say('journal.view.pick.next'), marked: say('journal.view.pick.marked') },
			onPick(date) {
				popover?.close('pick');
				ask.onPick(date);
			},
			onMonth(first, last) {
				void routes.days(first, last).then((r) => {
					if (r.ok && popover?.open) cal.mark(r.days.filter((d) => d.exists).map((d) => d.date));
				});
			},
		});
		popover = show(anchor, cal.el, ask.align, () => cal.focus());
	}

	function strip(anchor: HTMLElement, from: string, to: string, onPick: (date: string) => void): void {
		if (toggled(anchor)) return;
		const count = Math.min(daysBetween(from, to), STRIP_DAYS);
		const dates = Array.from({ length: count }, (_, i) => addDays(to, -i));
		let popover: Popover | null = null;
		const more = daysBetween(from, to) > STRIP_DAYS;
		const days = createDayStrip({
			dates, locale: LOCALE,
			labels: { group: say('journal.view.add.pick'), more: say('journal.view.pick.other') },
			onPick(date) {
				popover?.close('pick');
				onPick(date);
			},
			onMore: more ? () => {
				popover?.close('api');
				calendar(anchor, { value: to, min: from, max: to, align: 'center', onPick });
			} : undefined,
		});
		popover = show(anchor, days.el, 'center', () => days.focus());
	}

	return { calendar, strip, close: () => open?.popover.close('api') };
}
