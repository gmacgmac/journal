// THE DAY FILE, DECLARED ONCE. The reader, the save check and the tests all ask this file what a day looks like; none
// restates a rule. Carried from the proof's `format.ts`, with the blocks from nclite's parser in place of its mirror.
//
// One file per day at `YYYY/MM/YYYY-MM-DD.md`:
//   - the first line is `# Weekday D Month YYYY`, matching the file's date;
//   - each `## HH:MM` (optionally ` · Title`) starts an entry, `00:00` to `23:59`;
//   - an entry's body is paragraphs, lists and quotes; nothing else.
// No front matter, no IDs, no HTML, lines end with a plain `\n`.
import { blocksOf, type SpanBlock } from './blocks.ts';
import { dateTitle } from './dates.ts';

/** The most bytes a day file may hold; a larger one is not read, and no write may make one. */
export const MAX_DAY_BYTES = 256 * 1024;
/**
 * The most top-level blocks a day may hold, and the most bytes its text may take sent as a JSON string. A day over either
 * is too big, as one over {@link MAX_DAY_BYTES} is: each block costs its answer a key and offsets, and a control character
 * is sent as six bytes, so a day legal by size could otherwise answer past the contract's reply limit.
 */
export const MAX_DAY_BLOCKS = 2000;
export const MAX_DAY_JSON_BYTES = 384 * 1024;

/** An entry's heading. A time `HH:MM` (00:00 to 23:59), then ` · ` and a title. */
export const ENTRY_RE = /^## ([01]\d|2[0-3]):([0-5]\d)(?: · (\S.*))?$/;
/** A time as an entry and the person's edits name it. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The block kinds an entry's body may hold. */
export const BODY_KINDS: readonly string[] = ['paragraph', 'list', 'blockquote'];
/** A tag-shaped run. The parser never renders HTML, but the format refuses it outright. */
const HTML_RE = /<\/?[a-zA-Z][^>]*>/;
/** The most problems a day lists: a page broken on every line still answers in a small reply. */
export const MAX_PROBLEMS = 20;

export function dateHeading(date: string): string {
	return `# ${dateTitle(date)}`;
}

export function entryHeading(time: string, title: string | null = null): string {
	return title === null ? `## ${time}` : `## ${time} · ${title}`;
}

/** An entry heading's parts, or null when `text` is not one. */
export function entryOf(text: string): { time: string; title: string | null } | null {
	const m = ENTRY_RE.exec(text);
	return m === null ? null : { time: `${m[1]}:${m[2]}`, title: m[3] ?? null };
}

/** What is wrong with a day, by code; the engine words it (`src/engine/words.ts`). */
export type Problem =
	| { code: 'line-ends' }
	| { code: 'html' }
	| { code: 'date-line'; heading: string }
	| { code: 'entry-heading'; text: string }
	| { code: 'outside-entry' }
	| { code: 'body-kind'; kind: string };

const same = (a: Problem, b: Problem): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * What is wrong with `text` as the file for `date`; empty when nothing is. Checked on every read and on every save, after
 * the splice, before the write. A problem said twice is listed once, and at most {@link MAX_PROBLEMS} are listed.
 */
export function checkDay(date: string, text: string, blocks: SpanBlock[] = blocksOf(text)): Problem[] {
	const problems: Problem[] = [];
	const add = (p: Problem) => {
		if (problems.length < MAX_PROBLEMS && !problems.some((q) => same(p, q))) problems.push(p);
	};
	if (text.includes('\r')) add({ code: 'line-ends' });
	if (HTML_RE.test(text)) add({ code: 'html' });
	const [first, ...rest] = blocks;
	if (first === undefined || first.text !== dateHeading(date)) add({ code: 'date-line', heading: dateHeading(date) });
	let inEntry = false;
	for (const block of rest) {
		if (block.kind === 'heading') {
			if (entryOf(block.text) === null) add({ code: 'entry-heading', text: block.text.slice(0, 120) });
			inEntry = true;
			continue;
		}
		if (!inEntry) add({ code: 'outside-entry' });
		if (!BODY_KINDS.includes(block.kind)) add({ code: 'body-kind', kind: block.kind });
	}
	return problems;
}
