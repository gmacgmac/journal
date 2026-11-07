// Dates and ranges as the view needs them: pure, `YYYY-MM-DD` strings throughout, worked out in UTC so a time zone
// never moves a day. The day file's own rules and names (`addDays`, `WEEKDAYS`, `MONTHS`, `daysBetween`, `localToday`)
// are `src/format/`'s; this file holds only what the view adds on top.
import { addDays, daysBetween, MONTHS, WEEKDAYS } from '../format/index.ts';

/** The week starts on Monday (ISO): the Journal has no setting for it (spec § The manifest). */
export const WEEK_START = 1;

/** How long a chip's detail may run before it is cut with an ellipsis. */
export const SNIPPET = 72;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** `Mon 28 Sep` */
export function shortDate(date: string): string {
	const d = utc(date);
	return `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

/** `28 Sep` */
export function dayMonth(date: string): string {
	const d = utc(date);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

/** A block's words on one line, without Markdown's marks, cut to `SNIPPET`. */
export function snippet(text: string): string {
	const flat = text.replace(/[#*_`>[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();
	return flat.length <= SNIPPET ? flat : `${flat.slice(0, SNIPPET - 1)}…`;
}

/** The first day of `date`'s week; `weekStart` is 0 for Sunday, 1 for Monday. */
export const startOfWeek = (date: string, weekStart: number): string =>
	addDays(date, -((utc(date).getUTCDay() - weekStart + 7) % 7));

export interface Range {
	from: string;
	to: string;
}

/** The week round `date`. */
export function weekOf(date: string, weekStart = WEEK_START): Range {
	const from = startOfWeek(date, weekStart);
	return { from, to: addDays(from, 6) };
}

/** The same number of days before (`-1`) or after (`1`) `r`. */
export function shift(r: Range, dir: -1 | 1): Range {
	const n = dir * daysBetween(r.from, r.to);
	return { from: addDays(r.from, n), to: addDays(r.to, n) };
}
