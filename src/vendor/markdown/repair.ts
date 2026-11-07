/**
 * Tail repair for a buffer that is still arriving.
 *
 * A streamed message is cut at an arbitrary character, so the last construct is
 * usually half-written: `**bol` renders as literal asterisks and then flips to
 * bold one token later, which is the flicker every naive streaming renderer
 * has. Closing the tail before parsing makes the partial frame look like the
 * final one.
 *
 * IT APPENDS, IT NEVER REWRITES. The returned string is always the input plus
 * closers, so the caller can keep the raw buffer as the single source of truth
 * and re-repair on every chunk.
 *
 * Three rules earn their keep:
 * - Inside a fence, nothing inline is "open" — a fence body is not markdown, so
 *   the only thing owed is the closing fence.
 * - Inline state does not cross a blank line, so only the last paragraph-ish
 *   run of lines is scanned.
 * - A lone `[` is left alone. Closing it would invent a link destination, and
 *   an inline node that appears and then changes shape is worse than text.
 */

import { scanInline } from './inline.ts';
import { fenceCloses, fenceOpen, splitLines } from './parse.ts';
import type { FenceOpen } from './parse.ts';

/**
 * `text` with closers appended for whatever it left open. Returns `text`
 * unchanged when nothing is open.
 */
export function repairTail(text: string): string {
	if (text === '') return '';
	const lines = splitLines(text);

	// Walk the whole buffer for fence state; remember where the last block
	// boundary was, so inline scanning only sees the trailing run.
	let fence: FenceOpen | null = null;
	let blockStart = 0;
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;
		if (fence !== null) {
			if (fenceCloses(line, fence)) {
				fence = null;
				blockStart = i + 1;
			}
			continue;
		}
		const opened = fenceOpen(line);
		if (opened !== null) {
			fence = opened;
			continue;
		}
		if (line.trim() === '') blockStart = i + 1;
	}

	if (fence !== null) {
		const closer = fence.char.repeat(fence.len);
		return text.endsWith('\n') ? `${text}${closer}` : `${text}\n${closer}`;
	}

	const tail = lines.slice(blockStart).join('\n');
	// The block markers themselves are not inline delimiters: a `>` or a `-`
	// carries no closer, and stripping them keeps the scan honest about what is
	// emphasis and what is structure.
	const open = scanInline(stripBlockMarkers(tail)).open;
	return open.length === 0 ? text : text + open.join('');
}

/** Leading `>`, list markers and heading hashes, per line. */
function stripBlockMarkers(tail: string): string {
	return tail
		.split('\n')
		.map((line) =>
			line
				.replace(/^ {0,3}(?:> ?)+/, '')
				.replace(/^ *(?:[-+*]|\d{1,9}[.)])[ \t]+/, '')
				.replace(/^ {0,3}#{1,6}[ \t]+/, ''),
		)
		.join('\n');
}
