// A day's top-level blocks with their place in the file, from nclite's parser (`parseMarkdownSpans`, the vendored copy):
// the Journal never re-scans the grammar. Offsets are UTF-16 code units into the file's text.
import { parseMarkdownSpans } from '../vendor/markdown/index.ts';
import type { Block } from '../vendor/markdown/index.ts';

export interface SpanBlock {
	/** Offset of the block's first character. */
	start: number;
	/** Offset just past its last character; the line's `\n` is not included. */
	end: number;
	/** The block's source slice, exactly as written. */
	text: string;
	kind: Block['kind'];
}

export interface KeyedBlock {
	key: string;
	start: number;
	end: number;
	text: string;
}

/** Every top-level block of `text`, in order. */
export function blocksOf(text: string): SpanBlock[] {
	return parseMarkdownSpans(text).map(({ block, start, end }) => ({ start, end, text: text.slice(start, end), kind: block.kind }));
}

/** The kind of each top-level block of `text`. */
export const kindsOf = (text: string): Block['kind'][] => parseMarkdownSpans(text).map((s) => s.block.kind);

/** FNV-1a, 32 bits, over UTF-16 code units, as 8 lowercase hex digits. A screen key, not a security measure. */
export function hash(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

/** The shape of a block's key: its text's hash, `-`, and how many blocks with the same text come before it. */
export const KEY_RE = /^[0-9a-f]{8}-\d{1,6}$/;

/**
 * Blocks with their keys. A key does not depend on position, so a block that did not change keeps its key when blocks
 * above it are added or removed; any change to its text changes its key.
 */
export function keyedBlocks(text: string): KeyedBlock[] {
	const seen = new Map<string, number>();
	return blocksOf(text).map(({ start, end, text: t }) => {
		const h = hash(t);
		const n = seen.get(h) ?? 0;
		seen.set(h, n + 1);
		return { key: `${h}-${n}`, start, end, text: t };
	});
}
