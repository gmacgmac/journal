// Dates as the view needs them: pure, `YYYY-MM-DD` strings throughout, worked out in UTC so a time zone never moves a day.
// The day file's own rules and names (`addDays`, `WEEKDAYS`, `MONTHS`, `localToday`) are `src/format/`'s; this file holds
// only what the view adds on top.
import { addDays, MONTHS, WEEKDAYS } from '../format/index.ts';

/** How many days the running journal always shows, those with no page included: today and the six before it. */
export const RECENT_DAYS = 7;

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

export interface Range {
	from: string;
	to: string;
}

/** The last `n` days, ending on `today`. */
export const recentDays = (today: string, n = RECENT_DAYS): Range => ({ from: addDays(today, -(n - 1)), to: today });
