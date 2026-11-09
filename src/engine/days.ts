// Days as the person's routes and the chips see them: a day file read and worded (`Day`, the spec's § Routes), and a range
// read in whole days up to a budget of characters and of answer bytes.
import { checkDay, dateTitle, daysBetween, isDate, keyedBlocks, addDays } from '../format/index.ts';
import type { Day } from '../seam-types.ts';
import { REPLY_BUDGET, TOO_BIG_VARS, datesWithPages, jsonBytes, readDayFile, version, type DayFile } from '../store/index.ts';
import { problemText, word } from './words.ts';

/** The most days one `GET days` may ask for. */
export const MAX_RANGE_DAYS = 93;
/** What one `GET days` answer may hold: characters of day text, and bytes as JSON; always at least one day. */
export const DAYS_MAX_CHARS = 300000;
export const DAYS_BUDGET: ReadBudget = { chars: DAYS_MAX_CHARS, bytes: REPLY_BUDGET };
/** The most pages one `GET pages` may ask for, and how many it gives when it is not told. */
export const MAX_PAGES = 31;
export const PAGES_DEFAULT = 10;

/** `date`'s day as the routes answer it, from what is at its path. */
export function dayOf(date: string, file: DayFile): Day {
	const day: Day = { date, title: dateTitle(date), exists: file.state !== 'none', version: null, blocks: [], problems: [] };
	if (file.state === 'too-big') return { ...day, problems: [word('journal.problem.too-big', TOO_BIG_VARS)] };
	if (file.state === 'odd') return { ...day, problems: [word('journal.problem.not-a-file')] };
	if (file.state === 'none') return day;
	return { ...day, version: version(file.text), blocks: keyedBlocks(file.text), problems: checkDay(date, file.text).map(problemText) };
}

/** Why a range cannot be read (a words key), or null when `from`..`to` is a forward range of at most `max` real days. */
export function rangeProblem(from: unknown, to: unknown, max: number): 'journal.problem.dates-form' | 'journal.problem.dates-range' | null {
	if (!isDate(from) || !isDate(to)) return 'journal.problem.dates-form';
	const n = daysBetween(from, to);
	return n === 0 || n > max ? 'journal.problem.dates-range' : null;
}

/** What a range read may take: characters of day text, and bytes of the answer as the host measures it (`jsonBytes`). */
export interface ReadBudget {
	chars: number;
	bytes: number;
}

const charsOf = (file: DayFile): number => (file.state === 'text' ? file.text.length : 0);

/**
 * Whole days from `from` to `to` (a range already checked), each as `shape` makes it, until the next would take their text
 * past `budget.chars` or their answer, measured by `size`, past `budget.bytes`; always at least one. `next` is then the
 * first day left out. A day that fits `dayFits` alone answers well inside the reply limit, so the first one always may.
 */
export function readDays<T>(
	dir: string, from: string, to: string, budget: ReadBudget, shape: (date: string, file: DayFile) => T, size: (day: T) => number = jsonBytes,
): { days: T[]; next?: string } {
	const days: T[] = [];
	let chars = 0;
	let bytes = 0;
	for (let date = from; date <= to; date = addDays(date, 1)) {
		const file = readDayFile(dir, date);
		const day = shape(date, file);
		chars += charsOf(file);
		bytes += size(day) + 1;
		if (days.length > 0 && (chars > budget.chars || bytes > budget.bytes)) return { days, next: date };
		days.push(day);
	}
	return { days };
}

/**
 * The pages before `before` (not included), newest first: at most `count` days that have a file, each as `shape` makes it,
 * whole, under the same budget as a range (always at least one). `next` is the date to read on before, when older pages
 * are left: the oldest day given.
 */
export function readPages<T extends { date: string }>(
	dir: string, before: string, count: number, budget: ReadBudget, shape: (date: string, file: DayFile) => T, size: (day: T) => number = jsonBytes,
): { days: T[]; next?: string } {
	const dates = datesWithPages(dir, before, count + 1);
	const days: T[] = [];
	let chars = 0;
	let bytes = 0;
	for (const date of dates.slice(0, count)) {
		const file = readDayFile(dir, date);
		// A file that went between the listing and the read is not a page.
		if (file.state === 'none') continue;
		const day = shape(date, file);
		chars += charsOf(file);
		bytes += size(day) + 1;
		if (days.length > 0 && (chars > budget.chars || bytes > budget.bytes)) return { days, next: days.at(-1)!.date };
		days.push(day);
	}
	return dates.length > count && days.length > 0 ? { days, next: days.at(-1)!.date } : { days };
}
