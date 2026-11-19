// MOVING AN ENTRY (GM, 2026-11-19): the pure half of drag to reorder (`drag.ts` is the pointer and keys). A day's entries are
// read from its blocks; an entry can be dropped in any slot between two others that keeps the timed entries in time order
// (an entry with no time goes anywhere; one with a time only among the untimed entries between its timed neighbours); and
// the move is one `range` edit over exactly the entries it reorders, so one Undo puts them back.
import { entryOf } from '../format/index.ts';
import type { Block, RangeEdit } from './wire.ts';

/** One entry of a day: its heading, its writing, and its time (null for none). */
export interface EntrySpan {
	head: Block;
	blocks: Block[];
	time: string | null;
}

/** A day's writing (its blocks under the date line) as entries; blocks before the first heading belong to none. */
export function entriesOfDay(writing: readonly Block[]): EntrySpan[] {
	const entries: EntrySpan[] = [];
	for (const b of writing) {
		const entry = entryOf(b.text);
		if (entry !== null) entries.push({ head: b, blocks: [b], time: entry.time });
		else entries.at(-1)?.blocks.push(b);
	}
	return entries;
}

/**
 * The slots entry `from` may be dropped in, as indexes 0..n (before entry i, or n for the end). `from` and `from + 1` are
 * where it already is: always given, as "no move". The rest keep every timed entry in time order.
 */
export function slotsFor(entries: readonly EntrySpan[], from: number): number[] {
	const time = entries[from]?.time ?? null;
	const slots: number[] = [];
	for (let slot = 0; slot <= entries.length; slot += 1) {
		if (slot === from || slot === from + 1 || time === null) {
			slots.push(slot);
			continue;
		}
		const above = entries.slice(0, slot).filter((e, i) => i !== from && e.time !== null).at(-1)?.time;
		const below = entries.slice(slot).find((e, i) => i + slot !== from && e.time !== null)?.time;
		if ((above == null || above <= time) && (below == null || below >= time)) slots.push(slot);
	}
	return slots;
}

/** Whether dropping `from` in `slot` leaves the entries as they are. */
export const isStill = (from: number, slot: number): boolean => slot === from || slot === from + 1;

/** An entry as it is said aloud: its title, else its time. */
export function entryName(e: EntrySpan): string {
	const entry = entryOf(e.head.text);
	return entry?.title ?? entry?.time ?? '';
}

const textOf = (e: EntrySpan): string => e.blocks.map((b) => b.text).join('\n\n');

/**
 * The edit that moves entry `from` to `slot` on `date`, or null when it would move nothing or the entries it touches are
 * not laid out one blank line apart (a file edited by hand); the engine refuses it anyway if the bytes have changed.
 */
export function moveEdit(date: string, entries: readonly EntrySpan[], from: number, slot: number): RangeEdit | null {
	if (isStill(from, slot) || entries[from] === undefined || slot < 0 || slot > entries.length) return null;
	const to = slot > from ? slot - 1 : slot;
	const order = entries.filter((_, i) => i !== from);
	order.splice(to, 0, entries[from]!);
	const lo = Math.min(from, to);
	const hi = Math.max(from, to);
	const touched = entries.slice(lo, hi + 1);
	const blocks = touched.flatMap((e) => e.blocks);
	for (let i = 1; i < blocks.length; i += 1) if (blocks[i]!.start - blocks[i - 1]!.end !== 2) return null;
	return {
		op: 'range', date, start: blocks[0]!.start, end: blocks.at(-1)!.end,
		before: touched.map(textOf).join('\n\n'),
		after: order.slice(lo, hi + 1).map(textOf).join('\n\n'),
	};
}
