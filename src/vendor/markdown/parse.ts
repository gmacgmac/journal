/**
 * Block parsing — a single line-based scan.
 *
 * The order the checks run in IS the grammar, and it is deliberate: a fence
 * first (nothing inside one is markdown), then the constructs a line announces
 * with its first characters, then a table (which needs the *next* line to
 * confirm), then a list, and a paragraph as the fallback that never fails.
 *
 * TOTAL BY CONSTRUCTION. Every branch either consumes lines or falls through to
 * the paragraph case, so unknown syntax renders as the text the author typed
 * rather than throwing. That matters because the author is an untrusted agent
 * and the caller is a chat window.
 *
 * Two CommonMark behaviours are deliberately absent, because they turn a typo
 * into a silent structural change: blockquotes have no lazy continuation (every
 * line carries its `>`), and a list ends at the first unindented line that is
 * not another item.
 */

import { parseInline } from './inline.ts';
import type {
	Block,
	ColumnAlign,
	HeadingLevel,
	Inline,
	ListBlock,
	ListItem,
	TableBlock,
} from './types.ts';

/** Blockquote/list nesting past this reads as text. Guards pathological input. */
const MAX_BLOCK_DEPTH = 12;

/** A table wider than this reads as text: every row is padded to the header's width, so width times rows is the cost. Guards pathological input. */
export const MAX_TABLE_COLUMNS = 64;

/** What a line opens a fenced block with. */
export interface FenceOpen {
	char: string;
	len: number;
	indent: number;
	lang: string | null;
}

/** The fence this line opens, or `null`. */
export function fenceOpen(line: string): FenceOpen | null {
	const m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
	if (m === null) return null;
	const marker = m[2]!;
	const char = marker[0]!;
	const info = m[3]!.trim();
	// A backtick fence's info string may not contain a backtick — otherwise
	// ```` ``a`` ```` on its own line would read as a fence rather than a span.
	if (char === '`' && info.includes('`')) return null;
	return {
		char,
		len: marker.length,
		indent: m[1]!.length,
		lang: info === '' ? null : info.split(/\s+/)[0]!,
	};
}

/** Whether this line closes `fence`: same character, at least as long, alone. */
export function fenceCloses(line: string, fence: FenceOpen): boolean {
	const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
	return m !== null && m[1]![0] === fence.char && m[1]!.length >= fence.len;
}

/**
 * The block tree for a whole message. Never throws, for any input.
 */
export function parseMarkdown(text: string): Block[] {
	return parseBlocks(splitLines(text), 0, null);
}

/** A top-level block with its place in the source text. */
export interface SpannedBlock {
	block: Block;
	/** Offset of the block's first character in the text as given. */
	start: number;
	/** Offset just past its last character; the line ending is not included. */
	end: number;
}

/**
 * The same blocks as {@link parseMarkdown}, each with where it starts and ends
 * in `text`. The blocks and the gaps between them rebuild the source byte for
 * byte, and the gaps hold only whitespace. Offsets are into `text` as given, so
 * `\r\n` and tabs count as the characters they are. Built on the one scan, so
 * the two can never disagree about what a block is.
 */
export function parseMarkdownSpans(text: string): SpannedBlock[] {
	const starts = [0];
	const ends: number[] = [];
	const eol = /\r\n?|\n/g;
	for (let m = eol.exec(text); m !== null; m = eol.exec(text)) {
		ends.push(m.index);
		starts.push(m.index + m[0].length);
	}
	ends.push(text.length);
	const marks: [number, number][] = [];
	const blocks = parseBlocks(splitLines(text), 0, marks);
	return blocks.map((block, n) => {
		const [from, to] = marks[n]!;
		return { block, start: starts[from]!, end: ends[to - 1]! };
	});
}

/** Line endings normalised, leading tabs made countable as spaces. */
export function splitLines(text: string): string[] {
	return text
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)));
}

function leadingSpaces(line: string): number {
	let n = 0;
	while (line[n] === ' ') n += 1;
	return n;
}

function stripIndent(line: string, upTo: number): string {
	return line.slice(Math.min(upTo, leadingSpaces(line)));
}

function isBlank(line: string | undefined): boolean {
	return line === undefined || line.trim() === '';
}

/** `---`, `***`, `___` — three or more of one character, spaces allowed. */
function isHr(line: string): boolean {
	return /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/.test(line);
}

/** Up to three spaces, one to six `#`, then a blank or the end; the rest of the line is the heading's. */
const HEADING_RE = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;

const isBlankChar = (ch: string | undefined): boolean => ch === ' ' || ch === '\t';

/**
 * The heading this line is, or `null`. Its text drops the blanks around it, and
 * a closing run of `#` that has a blank before it. Found by walking indexes:
 * the regexes this replaces — `(.*?)[ \t]*$` and `[ \t]+#+$` — re-scanned a run
 * of blanks from every position in it (REVIEW_03 S1).
 */
function headingAt(line: string): { level: HeadingLevel; content: string } | null {
	const m = HEADING_RE.exec(line);
	if (m === null) return null;
	const rest = m[2]!;
	let from = 0;
	let to = rest.length;
	while (from < to && isBlankChar(rest[from])) from += 1;
	while (to > from && isBlankChar(rest[to - 1])) to -= 1;
	let hashes = to;
	while (hashes > from && rest[hashes - 1] === '#') hashes -= 1;
	let cut = hashes;
	while (cut > from && isBlankChar(rest[cut - 1])) cut -= 1;
	if (hashes < to && cut < hashes) to = cut;
	return { level: m[1]!.length as HeadingLevel, content: rest.slice(from, to) };
}

interface Marker {
	indent: number;
	ordered: boolean;
	number: number;
	/** Column the item's own content starts at. */
	content: number;
	/** The text after the marker on the marker's line. */
	rest: string;
}

/** The list marker this line carries, or `null`. */
function listMarker(line: string): Marker | null {
	const m = /^( *)([-+*]|\d{1,9}[.)])([ \t]+|$)/.exec(line);
	if (m === null) return null;
	const indent = m[1]!.length;
	const bullet = m[2]!;
	const gap = m[3]!.length;
	return {
		indent,
		ordered: !/^[-+*]$/.test(bullet),
		number: /^[-+*]$/.test(bullet) ? 1 : Number.parseInt(bullet, 10),
		content: indent + bullet.length + (gap === 0 ? 1 : gap),
		rest: line.slice(indent + bullet.length + gap),
	};
}

/** Whether a line begins a block that a paragraph cannot swallow. */
function startsBlock(lines: string[], at: number): boolean {
	const line = lines[at]!;
	if (isBlank(line)) return true;
	if (fenceOpen(line) !== null) return true;
	if (headingAt(line) !== null) return true;
	if (isHr(line)) return true;
	if (/^ {0,3}>/.test(line)) return true;
	if (listMarker(line) !== null) return true;
	return tableAt(lines, at) !== null;
}

/** `marks`, when given, collects each block's `[first line, line after last]`. */
function parseBlocks(lines: string[], depth: number, marks: [number, number][] | null): Block[] {
	const blocks: Block[] = [];
	let i = 0;
	let first = 0;
	const mark = (): void => {
		if (marks === null || marks.length === blocks.length) return;
		let last = i;
		// An unclosed fence owns its trailing blank lines: they are its text.
		const open = blocks[blocks.length - 1]!.kind === 'code' && i >= lines.length;
		while (!open && last > first + 1 && isBlank(lines[last - 1])) last -= 1;
		marks.push([first, last]);
	};
	while (i < lines.length) {
		mark();
		const line = lines[i]!;
		if (isBlank(line)) {
			i += 1;
			continue;
		}
		first = i;

		const fence = fenceOpen(line);
		if (fence !== null) {
			const body: string[] = [];
			i += 1;
			while (i < lines.length && !fenceCloses(lines[i]!, fence)) {
				body.push(stripIndent(lines[i]!, fence.indent));
				i += 1;
			}
			// A fence that never closed still yields its block: a truncated
			// message must render as code, not as the raw backticks.
			if (i < lines.length) i += 1;
			blocks.push({ kind: 'code', lang: fence.lang, text: body.join('\n') });
			continue;
		}

		const heading = headingAt(line);
		if (heading !== null) {
			blocks.push({ kind: 'heading', level: heading.level, children: parseInline(heading.content) });
			i += 1;
			continue;
		}

		if (isHr(line)) {
			blocks.push({ kind: 'hr' });
			i += 1;
			continue;
		}

		if (depth < MAX_BLOCK_DEPTH && /^ {0,3}>/.test(line)) {
			const inner: string[] = [];
			while (i < lines.length && /^ {0,3}>/.test(lines[i]!)) {
				inner.push(lines[i]!.replace(/^ {0,3}> ?/, ''));
				i += 1;
			}
			blocks.push({ kind: 'blockquote', children: parseBlocks(inner, depth + 1, null) });
			continue;
		}

		const table = tableAt(lines, i);
		if (table !== null) {
			blocks.push(table.block);
			i = table.next;
			continue;
		}

		if (depth < MAX_BLOCK_DEPTH && listMarker(line) !== null) {
			const list = listAt(lines, i, depth);
			blocks.push(list.block);
			i = list.next;
			continue;
		}

		const start = i;
		i += 1;
		while (i < lines.length && !startsBlock(lines, i)) i += 1;
		blocks.push({ kind: 'paragraph', children: parseInline(lines.slice(start, i).join('\n')) });
	}
	mark();
	return blocks;
}

interface TableAt {
	block: TableBlock;
	next: number;
}

/**
 * The GFM table starting at `at`, or `null`. A header row and a separator row
 * with the SAME number of cells are both required — that pair is the only thing
 * separating a table from a paragraph that happens to contain pipes.
 */
function tableAt(lines: string[], at: number): TableAt | null {
	const header = lines[at];
	const separator = lines[at + 1];
	if (header === undefined || separator === undefined) return null;
	if (!header.includes('|') || !separator.includes('-')) return null;

	const headerCells = splitRow(header);
	if (headerCells.length > MAX_TABLE_COLUMNS) return null;
	const alignCells = splitRow(separator);
	if (headerCells.length < 2 && !header.trim().startsWith('|')) return null;
	if (alignCells.length !== headerCells.length) return null;

	const align: ColumnAlign[] = [];
	for (const cell of alignCells) {
		const m = /^(:?)-+(:?)$/.exec(cell.trim());
		if (m === null) return null;
		const left = m[1] === ':';
		const right = m[2] === ':';
		align.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null);
	}

	const rows: Inline[][][] = [];
	let i = at + 2;
	while (i < lines.length) {
		const line = lines[i]!;
		if (isBlank(line) || !line.includes('|')) break;
		const cells = splitRow(line);
		// Ragged rows are padded and truncated to the header's width: a missing
		// cell is a missing cell, not a reason to drop the table.
		const row: Inline[][] = [];
		for (let c = 0; c < headerCells.length; c += 1) row.push(parseInline((cells[c] ?? '').trim()));
		rows.push(row);
		i += 1;
	}

	return {
		block: {
			kind: 'table',
			align,
			header: headerCells.map((cell) => parseInline(cell.trim())),
			rows,
		},
		next: i,
	};
}

/** Cells of one row. `\|` is a literal pipe and is left escaped for the inline pass. */
function splitRow(line: string): string[] {
	let body = line.trim();
	if (body.startsWith('|')) body = body.slice(1);
	if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);
	const cells: string[] = [];
	let cur = '';
	for (let i = 0; i < body.length; i += 1) {
		const ch = body[i]!;
		if (ch === '\\' && body[i + 1] === '|') {
			cur += '\\|';
			i += 1;
			continue;
		}
		if (ch === '|') {
			cells.push(cur);
			cur = '';
			continue;
		}
		cur += ch;
	}
	cells.push(cur);
	return cells;
}

interface ListAt {
	block: ListBlock;
	next: number;
}

/**
 * The list starting at `at`. Items are collected as raw lines, dedented to the
 * item's own content column, and then parsed as blocks — which is what makes a
 * nested list, a fenced block or a table inside an item work with no extra code.
 */
function listAt(lines: string[], at: number, depth: number): ListAt {
	const first = listMarker(lines[at]!)!;
	const baseIndent = first.indent;
	const ordered = first.ordered;
	const bodies: string[][] = [];
	let content = first.content;
	let i = at;

	while (i < lines.length) {
		const line = lines[i]!;

		if (isBlank(line)) {
			let j = i;
			while (j < lines.length && isBlank(lines[j]!)) j += 1;
			if (j >= lines.length) break;
			const ahead = lines[j]!;
			const aheadMarker = listMarker(ahead);
			const continues =
				leadingSpaces(ahead) > baseIndent ||
				(aheadMarker !== null &&
					aheadMarker.indent === baseIndent &&
					aheadMarker.ordered === ordered);
			if (!continues) break;
			const body = bodies[bodies.length - 1];
			if (body !== undefined) for (let k = i; k < j; k += 1) body.push('');
			i = j;
			continue;
		}

		const marker = listMarker(line);
		if (marker !== null && marker.indent <= baseIndent) {
			// A shallower marker belongs to an enclosing list; a different
			// ordered-ness is a different list, not a continuation of this one.
			if (marker.indent < baseIndent || marker.ordered !== ordered) break;
			bodies.push([marker.rest]);
			content = marker.content;
			i += 1;
			continue;
		}

		const body = bodies[bodies.length - 1];
		if (body === undefined) break;
		if (leadingSpaces(line) <= baseIndent) break;
		body.push(stripIndent(line, content));
		i += 1;
	}

	const items: ListItem[] = bodies.map((body) => {
		const task = /^\[([ xX])\](?:[ \t]+(.*))?$/.exec(body[0] ?? '');
		if (task !== null) body[0] = task[2] ?? '';
		return {
			checked: task === null ? null : task[1] !== ' ',
			children: parseBlocks(body, depth + 1, null),
		};
	});

	return {
		block: { kind: 'list', ordered, start: ordered ? first.number : 1, items },
		next: i,
	};
}
