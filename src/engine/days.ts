// Days as the person's routes and the chips see them: a day file read and worded (`Day`, the spec's § Routes), and a range
// read in whole days up to a character budget.
import { MAX_DAY_BYTES, checkDay, dateTitle, daysBetween, isDate, keyedBlocks, addDays } from '../format/index.ts';
import type { Day } from '../seam-types.ts';
import { readDayFile, version, type DayFile } from '../store/index.ts';
import { problemText, word } from './words.ts';

/** The most days one `GET days` may ask for. */
export const MAX_RANGE_DAYS = 93;
/** The most characters of day text one `GET days` answer holds; always at least one day. */
export const DAYS_MAX_CHARS = 300000;

/** `date`'s day as the routes answer it, from what is at its path. */
export function dayOf(date: string, file: DayFile): Day {
	const day: Day = { date, title: dateTitle(date), exists: file.state !== 'none', version: null, blocks: [], problems: [] };
	if (file.state === 'too-big') return { ...day, problems: [word('journal.problem.too-big', { max: MAX_DAY_BYTES / 1024 })] };
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

/** The length a day counts against a budget: its file's text, 0 for anything not read. */
const sizeOf = (file: DayFile): number => (file.state === 'text' ? file.text.length : 0);

/**
 * Whole days from `from` to `to` (a range already checked) until the next would take their text past `maxChars`; always at
 * least one. `next` is then the first day left out.
 */
export function readDays(dir: string, from: string, to: string, maxChars: number): { days: { date: string; file: DayFile }[]; next?: string } {
	const days: { date: string; file: DayFile }[] = [];
	let chars = 0;
	for (let date = from; date <= to; date = addDays(date, 1)) {
		const file = readDayFile(dir, date);
		chars += sizeOf(file);
		if (days.length > 0 && chars > maxChars) return { days, next: date };
		days.push({ date, file });
	}
	return { days };
}
