// Dates and ranges as the view needs them: pure, `YYYY-MM-DD` strings throughout, worked out in UTC so a time zone
// never moves a day.
// TEMPORARY COPY: `addDays`, `WEEKDAYS`, `MONTHS`, `ENTRY_RE` and `entryHeading` are the day file's rules from the
// proof's `format.ts`, which JR_02 moves into `src/format/`. Once it lands they are imported from there and deleted
// here (one home per rule).

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];
export const ENTRY_RE = /^## (\d{2}):(\d{2})(?: · (\S.*))?$/;

export function addDays(date: string, n: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

export function entryHeading(time: string, title: string | null = null): string {
	return title === null ? `## ${time}` : `## ${time} · ${title}`;
}

/** How long a chip's detail may run before it is cut with an ellipsis. */
export const SNIPPET = 72;

/** Today's date where the person is. `now` is for tests. */
export const localToday = (now = new Date()): string =>
	new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** `Mon 28 Sep` */
export function shortDate(date: string): string {
	const d = new Date(`${date}T00:00:00Z`);
	return `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

/** A block's words on one line, without Markdown's marks, cut to `SNIPPET`. */
export function snippet(text: string): string {
	const flat = text.replace(/[#*_`>[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();
	return flat.length <= SNIPPET ? flat : `${flat.slice(0, SNIPPET - 1)}…`;
}

/** Days from `from` to `to`, both included. */
export const spanOf = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

/** The first day of `date`'s week; `weekStart` is 0 for Sunday, 1 for Monday. */
export const startOfWeek = (date: string, weekStart: number): string =>
	addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() - weekStart + 7) % 7));

export interface Range {
	from: string;
	to: string;
}

/** The week round `date`. */
export function weekOf(date: string, weekStart: number): Range {
	const from = startOfWeek(date, weekStart);
	return { from, to: addDays(from, 6) };
}

/** The same number of days before (`-1`) or after (`1`) `r`. */
export function shift(r: Range, dir: -1 | 1): Range {
	const n = dir * spanOf(r.from, r.to);
	return { from: addDays(r.from, n), to: addDays(r.to, n) };
}

/** The week starting a setting names: `sunday` is 0, anything else Monday. */
export const weekStartOf = (setting: string | undefined): number => (setting === 'sunday' ? 0 : 1);
