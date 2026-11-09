// `read_days`: whole days from `from` until the next would not fit, each with its version, as the bot reads them
// (docs/specification/plugin.md § Tools, What a read gives). The same read the person's `GET days` makes, on a smaller budget.
import type { ToolResult } from '../../vendor/plugin-host/plugin-host.ts';
import { entriesOf, entryHeading, isDate } from '../../format/index.ts';
import type { ReadDay, ReadResult } from '../../seam-types.ts';
import { REPLY_BUDGET, jsonBytes, type DayFile } from '../../store/index.ts';
import { dayOf, rangeProblem, readDays } from '../days.ts';
import { word } from '../words.ts';
import { done, refused } from './result.ts';
import { READ_MAX_CHARS, READ_MAX_DAYS } from './schemas.ts';

/** One day as the bot reads it: a line naming it, its problems, then its file as it is. */
function said(day: ReadDay): string {
	const names = { title: day.title, date: day.date };
	if (!day.exists) return word('journal.read.none', names);
	if (day.version === null) return word('journal.read.unread', { ...names, problem: day.problems.join(' ') });
	const lines = [word('journal.read.day', { ...names, version: day.version })];
	if (day.problems.length > 0) lines.push(word('journal.read.problems'), ...day.problems.map((p) => `- ${p}`));
	if (day.entries.length > 0) {
		lines.push(word('journal.read.entries'), ...day.entries.map((e) => word('journal.read.entry', { id: e.id, heading: entryHeading(e.time, e.title).slice(3) })));
	}
	return `${lines.join('\n')}\n\n${day.text.trimEnd()}`;
}

/** A day as the bot reads it, with each entry's id: what a change names an entry by. */
function readDay(date: string, file: DayFile): ReadDay {
	const { title, exists, version, problems } = dayOf(date, file);
	const text = file.state === 'text' ? file.text : '';
	const entries = version === null ? [] : entriesOf(text).map(({ id, time, title: t }) => ({ id, time, title: t }));
	return { date, title, exists, version, text, problems, entries };
}

/** What a day adds to the answer: its sentences for the bot, and the same day again for code. */
const sizeOf = (day: ReadDay): number => jsonBytes(said(day)) + jsonBytes(day);

/** Reads `input.from` to `input.to` (an input already checked against its schema). */
export function readDaysTool(dir: string, input: { from: string; to?: string }): ToolResult {
	const from = input.from;
	const to = input.to ?? from;
	if (!isDate(from)) return refused('input', { field: 'from' });
	if (!isDate(to)) return refused('input', { field: 'to' });
	if (rangeProblem(from, to, READ_MAX_DAYS) !== null) return refused('dates', { max: READ_MAX_DAYS });
	const read = readDays(dir, from, to, { chars: READ_MAX_CHARS, bytes: REPLY_BUDGET }, readDay, sizeOf);
	const days = read.days;
	const result: ReadResult = { days };
	const parts = days.map(said);
	if (read.next !== undefined) {
		result.next = read.next;
		parts.push(word('journal.read.next', { next: read.next }));
	}
	return done(parts.join('\n\n'), result);
}
