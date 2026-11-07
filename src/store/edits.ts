// The four edits a page can ask for, each planned as pure text in, text out (carried from the proof's `store/edits.ts`).
// Every one is anchored to bytes the editor saw and is refused, never merged, when those bytes have changed; every result
// is checked against the day's rules (`src/format/`).
//
//   replace  one block becomes other writing (empty deletes it)
//   insert   new writing after a block
//   entry    a new entry, placed in time order; the day's page is made if missing
//   range    exact bytes swapped for others: how an undo is applied
//
// A block open for writing survives a write earlier in the day (D29): when `start..end` no longer holds `before` but exactly
// one top-level block of the day now equals it, a `replace` or an `insert` anchors to that block. A `range` never moves.
import {
	MAX_DAY_BLOCKS, MAX_DAY_BYTES, TIME_RE, blocksOf, checkDay, dateHeading, entryHeading, entryOf, kindsOf,
	type Problem, type SpanBlock,
} from '../format/index.ts';
import type { WordKey } from '../engine/words.ts';
import type { Edit, RangeEdit } from '../seam-types.ts';
import { dayFits } from './size.ts';

export type RefusalCode = 'unreadable' | 'changed' | 'rules' | 'heading' | 'date-heading' | 'entry-exists' | 'malformed' | 'too-big';

/** Why an edit was not saved: its status and code, the words key that says so, and the rules broken for `rules`. */
export interface Refusal {
	ok: false;
	status: 400 | 409 | 422;
	code: RefusalCode;
	say: WordKey;
	vars?: Record<string, string | number>;
	problems?: Problem[];
}

export type Plan = { ok: true; text: string } | Refusal;

const refuse = (status: Refusal['status'], code: RefusalCode, say: WordKey, vars?: Refusal['vars']): Refusal =>
	vars === undefined ? { ok: false, status, code, say } : { ok: false, status, code, say, vars };

/** What a too-big sentence fills: a page's limits in KB and in blocks. */
export const TOO_BIG_VARS: Readonly<Record<string, number>> = { max: MAX_DAY_BYTES / 1024, blocks: MAX_DAY_BLOCKS };

/** The day after the edit, if it keeps the rules and fits (`dayFits`). */
function checked(date: string, text: string): Plan {
	const blocks = blocksOf(text);
	if (!dayFits(text, blocks)) return refuse(422, 'too-big', 'journal.problem.would-be-too-big', TOO_BIG_VARS);
	const problems = checkDay(date, text, blocks);
	return problems.length === 0 ? { ok: true, text } : { ...refuse(422, 'rules', 'journal.problem.malformed'), problems };
}

/** The block the editor opened: still at its offsets, or else the one block whose text is `before`; null when neither. */
export function anchorOf(blocks: SpanBlock[], e: { start: number; end: number; before: string }): { block: SpanBlock; index: number } | null {
	const at = blocks.findIndex((b) => b.start === e.start && b.end === e.end && b.text === e.before);
	if (at >= 0) return { block: blocks[at]!, index: at };
	const same = blocks.flatMap((b, index) => (b.text === e.before ? [{ block: b, index }] : []));
	return same.length === 1 ? same[0]! : null;
}

/** The range a delete removes: the block and the blank line after it, nothing more. */
function deleteRange(text: string, start: number, end: number): [number, number] {
	if (text.startsWith('\n\n', end)) return [start, end + 2];
	// The last block has no blank line after it, so the one before it goes instead.
	if (text.slice(start - 2, start) === '\n\n') return [start - 2, end];
	return [start, end];
}

/** Writing from the page, tidied: no blank lines round it, no trailing spaces. */
const tidy = (text: string): string => text.replace(/^(?:[ \t]*\n)+/, '').trimEnd();

/** The times of the day's entries, other than the block at `skip`. */
function timesOf(blocks: SpanBlock[], skip = -1): string[] {
	const times: string[] = [];
	blocks.forEach((b, i) => {
		const entry = i === skip || b.kind !== 'heading' ? null : entryOf(b.text);
		if (entry !== null) times.push(entry.time);
	});
	return times;
}

function planReplace(date: string, text: string, e: Extract<Edit, { op: 'replace' }>): Plan {
	const blocks = blocksOf(text);
	const found = anchorOf(blocks, e);
	if (found === null) return refuse(409, 'changed', 'journal.problem.changed');
	const { block, index } = found;
	if (index === 0) return refuse(422, 'date-heading', 'journal.problem.date-heading');
	const after = tidy(e.after);
	if (after === '') {
		const [from, to] = deleteRange(text, block.start, block.end);
		return checked(date, text.slice(0, from) + text.slice(to));
	}
	const now = kindsOf(after);
	if (block.kind === 'heading') {
		const entry = entryOf(after);
		if (now.length !== 1 || entry === null) return refuse(422, 'heading', 'journal.problem.entry-heading-form');
		if (timesOf(blocks, index).includes(entry.time)) return refuse(422, 'entry-exists', 'journal.problem.entry-exists', { time: entry.time });
	} else if (now.includes('heading')) return refuse(422, 'heading', 'journal.problem.heading');
	return checked(date, text.slice(0, block.start) + after + text.slice(block.end));
}

function planInsert(date: string, text: string, e: Extract<Edit, { op: 'insert' }>): Plan {
	const found = anchorOf(blocksOf(text), e);
	if (found === null) return refuse(409, 'changed', 'journal.problem.changed');
	const add = tidy(e.text);
	if (add === '') return refuse(400, 'unreadable', 'journal.problem.empty');
	if (kindsOf(add).includes('heading')) return refuse(422, 'heading', 'journal.problem.heading');
	const at = found.block.end;
	return checked(date, `${text.slice(0, at)}\n\n${add}${text.slice(at)}`);
}

/** A new entry goes before the first entry that is later in the day, or at the end. */
function planEntry(date: string, text: string | null, e: Extract<Edit, { op: 'entry' }>): Plan {
	const title = e.title === null || e.title.trim() === '' ? null : e.title.trim();
	const body = tidy(e.text);
	if (!TIME_RE.test(e.time) || (title !== null && /[\r\n]/.test(title))) return refuse(400, 'unreadable', 'journal.problem.entry-time');
	if (body !== '' && kindsOf(body).includes('heading')) return refuse(422, 'heading', 'journal.problem.heading');
	const entry = body === '' ? entryHeading(e.time, title) : `${entryHeading(e.time, title)}\n\n${body}`;
	if (text === null) return checked(date, `${dateHeading(date)}\n\n${entry}\n`);
	const blocks = blocksOf(text);
	if (timesOf(blocks).includes(e.time)) return refuse(422, 'entry-exists', 'journal.problem.entry-exists', { time: e.time });
	const later = blocks.find((b) => b.kind === 'heading' && (entryOf(b.text)?.time ?? '') > e.time);
	if (later !== undefined) return checked(date, `${text.slice(0, later.start)}${entry}\n\n${text.slice(later.start)}`);
	return checked(date, `${text.trimEnd()}\n\n${entry}\n`);
}

function planRange(date: string, text: string, e: RangeEdit): Plan {
	if (e.end > text.length || text.slice(e.start, e.end) !== e.before) return refuse(409, 'changed', 'journal.problem.undo-changed');
	return checked(date, text.slice(0, e.start) + e.after + text.slice(e.end));
}

/**
 * The file's text after `e`, or why not. `text` is `null` when the day has no page yet. A day that already breaks its rules
 * takes no edit at all: it is refused `malformed`, and is fixed in the file itself.
 */
export function plan(date: string, text: string | null, e: Edit): Plan {
	if (text !== null && checkDay(date, text).length > 0) return refuse(422, 'malformed', 'journal.problem.malformed');
	if (e.op === 'entry') return planEntry(date, text, e);
	if (text === null) return refuse(409, 'changed', 'journal.problem.no-page');
	if (e.op === 'replace') return planReplace(date, text, e);
	if (e.op === 'insert') return planInsert(date, text, e);
	return planRange(date, text, e);
}

/** The edit that puts `before` back, over exactly the bytes that changed. */
export function undoOf(date: string, before: string, after: string): RangeEdit {
	let head = 0;
	while (head < before.length && head < after.length && before[head] === after[head]) head += 1;
	let tail = 0;
	while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail += 1;
	return { op: 'range', date, start: head, end: after.length - tail, before: after.slice(head, after.length - tail), after: before.slice(head, before.length - tail) };
}

/** Whether `e` is an Edit the store can plan: its op's fields of the right types, offsets whole numbers in order. */
export function isEdit(e: unknown): e is Edit {
	if (typeof e !== 'object' || e === null || Array.isArray(e)) return false;
	const v = e as Record<string, unknown>;
	const str = (k: string) => typeof v[k] === 'string';
	const offsets = () => Number.isSafeInteger(v.start) && Number.isSafeInteger(v.end) && (v.start as number) >= 0 && (v.end as number) >= (v.start as number);
	if (!str('date')) return false;
	switch (v.op) {
		case 'replace': case 'range': return offsets() && str('before') && str('after');
		case 'insert': return offsets() && str('before') && str('text');
		case 'entry': return str('time') && str('text') && (v.title === null || str('title'));
		default: return false;
	}
}
