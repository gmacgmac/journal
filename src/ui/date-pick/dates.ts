// Calendar days as `YYYY-MM-DD` strings, worked out in UTC so a time zone never moves a day. The package's own: it
// imports nothing, so it moves to another app as it is.

export type IsoDate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const utc = (d: IsoDate) => new Date(`${d}T00:00:00Z`);
const iso = (t: Date): IsoDate => t.toISOString().slice(0, 10);

/** A real calendar day written `YYYY-MM-DD`. */
export const isIsoDate = (s: string): boolean => ISO_RE.test(s) && iso(utc(s)) === s;

export const addDays = (d: IsoDate, n: number): IsoDate => iso(new Date(utc(d).getTime() + n * 86_400_000));

/** The first of `d`'s month, moved by `n` months. */
export function addMonths(d: IsoDate, n: number): IsoDate {
	const t = utc(d);
	return iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + n, 1)));
}

/** `d`'s month moved by `n` months, on the same day where the month has it, else on its last day. */
export function shiftMonths(d: IsoDate, n: number): IsoDate {
	const first = addMonths(d, n);
	return addDays(first, Math.min(Number(d.slice(8)), daysInMonth(first)) - 1);
}

export const monthStart = (d: IsoDate): IsoDate => `${d.slice(0, 7)}-01`;

export function daysInMonth(d: IsoDate): number {
	const t = utc(d);
	return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
}

/** 0 for Sunday to 6 for Saturday. */
export const weekday = (d: IsoDate): number => utc(d).getUTCDay();

/** `d` held between `min` and `max`, either left out. */
export const clamp = (d: IsoDate, min?: IsoDate, max?: IsoDate): IsoDate => (min !== undefined && d < min ? min : max !== undefined && d > max ? max : d);

/** Today where the person is. */
export function localToday(now = new Date()): IsoDate {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** A day written for `locale` with Intl's `options`, read as the calendar day it is (in UTC, so it never moves). */
export const format = (d: IsoDate, locale: string | undefined, options: Intl.DateTimeFormatOptions): string =>
	new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utc(d));
