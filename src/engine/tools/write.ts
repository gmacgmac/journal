// The four writes (docs/specification/plugin.md § Tools): `add_entry`, `replace_block`, `delete_block`, `insert_after`.
// Each reads the day, checks the version the bot read against the very text it then plans on, finds the anchored block,
// plans the edit with the store's own planner (`plan`: the day's rules, the same refusals the person's edits get) and
// writes it atomically (`writeDay`). A refusal writes nothing.
import type { ChangeMeta, ToolResult } from '../../vendor/plugin-host/plugin-host.ts';
import {
	blocksOf, checkDay, dateHeading, dateTitle, dayPath, entryOf, isDate, keyedBlocks, type SpanBlock,
} from '../../format/index.ts';
import type { Edit, WriteResult } from '../../seam-types.ts';
import { TOO_BIG_VARS, plan, readDayFile, version as versionOf, writeDay, type Refusal } from '../../store/index.ts';
import { problemText, word } from '../words.ts';
import { done, refused } from './result.ts';

export interface EntryInput { date: string; time: string; text: string; title?: string; version?: string | null; future?: boolean }
export interface AnchorInput { date: string; version: string | null; entry: string; block: string; nth?: number; future?: boolean }
export type BlockOp = 'replace' | 'delete' | 'insert';

/** The refusal for a write to a day after `today` that did not pass `future: true`; null when the write may go on. */
function tooLate(date: string, future: boolean | undefined, today: () => string): ToolResult | null {
	const now = today();
	return isDate(date) && date > now && future !== true ? refused('future', { title: dateTitle(date), today: now }) : null;
}

/** The words every refusal about a day may fill. */
const about = (date: string) => ({ title: dateTitle(date), path: dayPath(date) });

/**
 * The day's text, once it is one the tools may change and `given` (when not undefined) is its version now; null for a day
 * with no page, when `needPage` is false. Otherwise the refusal.
 */
function opened(dir: string, date: string, given: string | null | undefined, needPage: boolean): { text: string | null } | ToolResult {
	if (!isDate(date)) return refused('input', { field: 'date' });
	const file = readDayFile(dir, date);
	if (file.state === 'too-big') return refused('too-big', { ...about(date), ...TOO_BIG_VARS });
	if (file.state === 'odd') return refused('malformed', { ...about(date), problems: word('journal.problem.not-a-file') });
	if (file.state === 'none') {
		if (needPage) return refused('no-page', about(date));
		return given === undefined || given === null ? { text: null } : refused('stale');
	}
	const problems = checkDay(date, file.text);
	if (problems.length > 0) return refused('malformed', { ...about(date), problems: problems.map(problemText).join(' ') });
	if (given !== undefined && given !== versionOf(file.text)) return refused('stale');
	return { text: file.text };
}

/** The block `a` names: under the one entry at `a.entry`, whose whole text is `a.block`, the `nth` such from the top. */
function anchored(date: string, text: string, a: AnchorInput): SpanBlock | ToolResult {
	const blocks = blocksOf(text);
	const want = a.block.trim();
	if (want === dateHeading(date)) return refused('date-heading');
	const heads = blocks.flatMap((b, i) => (b.kind === 'heading' && entryOf(b.text)?.time === a.entry ? [i] : []));
	const vars = { ...about(date), entry: a.entry };
	if (heads.length === 0) return refused('no-entry', vars);
	if (heads.length > 1) return refused('ambiguous-entry', { ...vars, count: heads.length });
	const first = heads[0]!;
	const next = blocks.findIndex((b, i) => i > first && b.kind === 'heading');
	const matches = blocks.slice(first, next < 0 ? blocks.length : next).filter((b) => b.text.trim() === want);
	if (matches.length === 0) return refused('no-block', vars);
	if ((a.nth === undefined && matches.length > 1) || (a.nth ?? 1) > matches.length) return refused('ambiguous', { ...vars, count: matches.length });
	return matches[(a.nth ?? 1) - 1]!;
}

/** The store's refusal as the bot's. */
function storeRefusal(date: string, r: Refusal): ToolResult {
	switch (r.code) {
		case 'rules': return refused('rules', { problems: (r.problems ?? []).map(problemText).join(' ') });
		case 'entry-exists': return refused('entry-exists', { ...about(date), time: r.vars?.time ?? '' });
		case 'too-big': return refused('too-big', r.vars, r.say);
		case 'malformed': return refused('malformed', { ...about(date), problems: '' });
		case 'heading': case 'date-heading': return refused(r.code);
		case 'changed': return refused('stale');
		case 'unreadable': return refused('input', { field: 'text' });
	}
}

/** What a write says of itself: its change words, the entry's time (from the changed block's new text), where the changed
 * block now starts (null for a removal), and how many blocks it wrote. */
interface Wrote {
	words: string;
	entry: (blockText: string | undefined) => string;
	at: (after: string) => number | null;
	count: (before: string | null, after: string) => number;
}

/** Plans `e` on `before`, writes it, and answers with the day's new version, the block's key and the change line. */
function save(dir: string, before: string | null, e: Edit, how: Wrote, wrote: (date: string) => void): ToolResult {
	const planned = plan(e.date, before, e);
	if (!planned.ok) return storeRefusal(e.date, planned);
	writeDay(dir, e.date, planned.text);
	wrote(e.date);
	const after = planned.text;
	const at = how.at(after);
	const block = at === null ? undefined : keyedBlocks(after).find((b) => b.start === at);
	const structured: WriteResult = { date: e.date, version: versionOf(after), entry: how.entry(block?.text) };
	if (block !== undefined) structured.key = block.key;
	const subject = dateTitle(e.date);
	const change: ChangeMeta = { words: how.words, count: how.count(before, after), subject, reveal: block === undefined ? { date: e.date } : { date: e.date, key: block.key } };
	return done(word('journal.saved', { title: subject, date: e.date, version: structured.version }), structured, change);
}

/** `add_entry`: a new entry placed by its time; the day's page is made when it has none. */
export function addEntry(dir: string, input: EntryInput, wrote: (date: string) => void, today: () => string): ToolResult {
	const late = tooLate(input.date, input.future, today);
	if (late !== null) return late;
	const day = opened(dir, input.date, input.version, false);
	if ('content' in day) return day;
	if (input.text.trim() === '') return refused('input', { field: 'text' });
	const e: Edit = { op: 'entry', date: input.date, time: input.time, title: input.title ?? null, text: input.text };
	return save(dir, day.text, e, {
		words: 'journal.change.entry',
		entry: () => input.time,
		at: (after) => blocksOf(after).find((b) => b.kind === 'heading' && entryOf(b.text)?.time === input.time)?.start ?? null,
		count: () => 1,
	}, wrote);
}

/** `replace_block`, `delete_block` and `insert_after`: one anchored block replaced, removed, or written after. */
export function changeBlock(dir: string, op: BlockOp, input: AnchorInput & { text?: string }, wrote: (date: string) => void, today: () => string): ToolResult {
	const late = tooLate(input.date, input.future, today);
	if (late !== null) return late;
	const day = opened(dir, input.date, input.version, true);
	if ('content' in day) return day;
	const before = day.text!;
	const block = anchored(input.date, before, input);
	if ('content' in block) return block;
	const text = input.text ?? '';
	if (op !== 'delete' && text.trim() === '') return refused('input', { field: 'text' });
	const span = { date: input.date, start: block.start, end: block.end, before: block.text };
	const e: Edit = op === 'insert' ? { op: 'insert', ...span, text } : { op: 'replace', ...span, after: op === 'delete' ? '' : text };
	return save(dir, before, e, {
		words: `journal.change.${op}`,
		// A heading replaced gives its entry a new time.
		entry: (t) => (op === 'replace' && block.kind === 'heading' && t !== undefined ? entryOf(t)?.time ?? input.entry : input.entry),
		at: () => (op === 'delete' ? null : op === 'insert' ? block.end + 2 : block.start),
		count: (was, after) => (op === 'insert' ? blocksOf(after).length - blocksOf(was ?? '').length : 1),
	}, wrote);
}
