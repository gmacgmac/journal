// MOVING AN ENTRY (GM, 2026-11-19): what the view adds to the entry rules in `format/entries.ts` (which entries a day has and
// which places keep the timed ones in time order) for drag to reorder (`drag.ts` is the pointer and keys). The view says
// what it wants, "this entry in front of that one", and the engine moves the bytes, so a hand-spaced file moves as well as
// any other.
import type { EntrySpan } from '../format/index.ts';
import type { Block, Edit } from './wire.ts';

/** Whether dropping `from` in `slot` leaves the entries as they are. */
export const isStill = (from: number, slot: number): boolean => slot === from || slot === from + 1;

/** An entry as it is said aloud: its title, else its time. */
export const entryName = (e: Pick<EntrySpan, 'title' | 'time'>): string => e.title ?? e.time ?? '';

/**
 * The edit that moves entry `from` to `slot` on `date`: in front of the entry that is in `slot`, or at the end of the day
 * when `slot` is past the last. Null when it would move nothing or names no place.
 */
export function moveEditOf(date: string, spans: readonly EntrySpan<Block>[], from: number, slot: number): Extract<Edit, { op: 'move' }> | null {
	if (isStill(from, slot) || spans[from] === undefined || slot < 0 || slot > spans.length) return null;
	return { op: 'move', date, entry: spans[from].id, blocks: spans[from].blocks.map((b) => b.key), before: spans[slot]?.id ?? null };
}
