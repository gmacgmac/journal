// Dates as the day files name them: `YYYY-MM-DD` strings throughout, worked out in UTC so a time zone never moves a day.
// Carried from the proof's `format.ts` (nclite `prototypes/journal-paper/`).

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

export const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const utc = (date: string): Date => new Date(`${date}T00:00:00Z`);

/** Whether `date` is a real calendar day in `YYYY-MM-DD` form. Anything that is not a string is not a date. */
export function isDate(date: unknown): date is string {
	if (typeof date !== 'string' || !DATE_RE.test(date)) return false;
	const d = utc(date);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** The day file's path under the data folder, with `/` separators: `2026/11/2026-11-07.md`. */
export function dayPath(date: string): string {
	return `${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`;
}

/** The date a path names, or `null` if the path is not a day file at its own place. */
export function dateOfPath(path: string): string | null {
	const m = /(?:^|[\\/])(\d{4})[\\/](\d{2})[\\/]((\d{4})-(\d{2})-\d{2})\.md$/.exec(path);
	if (m === null || m[1] !== m[4] || m[2] !== m[5] || !isDate(m[3]!)) return null;
	return m[3]!;
}

export function addDays(date: string, n: number): string {
	const d = utc(date);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included; 0 when `to` is before `from`. */
export const daysBetween = (from: string, to: string): number => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);

/** Every date from `from` to `to`, both included. */
export function datesBetween(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
	return out;
}

/** `Saturday 7 November 2026` */
export function dateTitle(date: string): string {
	const d = utc(date);
	return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A range said short: `2 to 8 November 2026`, `28 September to 4 October 2026`, `28 December 2026 to 3 January 2027`. */
export function rangeParts(from: string, to: string): { from: string; to: string } {
	const a = utc(from);
	const b = utc(to);
	const day = (d: Date) => `${d.getUTCDate()}`;
	const month = (d: Date) => MONTHS[d.getUTCMonth()]!;
	const end = `${day(b)} ${month(b)} ${b.getUTCFullYear()}`;
	if (a.getUTCFullYear() !== b.getUTCFullYear()) return { from: `${day(a)} ${month(a)} ${a.getUTCFullYear()}`, to: end };
	if (a.getUTCMonth() !== b.getUTCMonth()) return { from: `${day(a)} ${month(a)}`, to: end };
	return { from: day(a), to: end };
}

/** Today's date where the engine runs, the person's own clock. `now` is for tests. */
export const localToday = (now = new Date()): string =>
	new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
