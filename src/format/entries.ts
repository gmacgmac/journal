// THE ENTRY RULES, IN ONE PLACE (GM, 2026-11-19): what a day's entries are, which places an entry may be moved to, and
// whether a day has any writing. The engine plans moves and removals by them and the view offers its drop places by them,
// so neither restates them. What counts as an entry heading is `entryOf` (`day.ts`); this file builds on it, never the
// other way round.
import { keyedBlocks, type KeyedBlock } from './blocks.ts';
import { entryOf } from './day.ts';

/** The least a block must carry to be grouped into entries: a keyed block's key, place and text (a `Day`'s blocks carry no kind). */
export type EntryBlock = Pick<KeyedBlock, 'key' | 'start' | 'end' | 'text'>;

/** One entry of a day: its id (its heading's key), its time and title, and its blocks, heading first. */
export interface EntrySpan<B extends EntryBlock = EntryBlock> {
	id: string;
	time: string | null;
	title: string | null;
	blocks: B[];
}

/**
 * A day's blocks grouped into entries, in the file's order. Grouping starts at the first entry heading, so the date line
 * and anything else before it belong to no entry.
 */
export function entrySpans<B extends EntryBlock>(blocks: readonly B[]): EntrySpan<B>[] {
	const spans: EntrySpan<B>[] = [];
	for (const b of blocks) {
		const entry = entryOf(b.text);
		if (entry !== null) spans.push({ id: b.key, time: entry.time, title: entry.title, blocks: [b] });
		else spans.at(-1)?.blocks.push(b);
	}
	return spans;
}

/** A day's text as its entries, each with its keyed blocks: what the engine plans entry edits by. */
export const entrySpansOf = (text: string): EntrySpan<KeyedBlock>[] => entrySpans(keyedBlocks(text));

/**
 * Whether a timed entry may stand between the nearest timed entries above and below it (either absent). Strict: one entry to
 * a time, as a new entry or a new time at a taken one is refused (`entry-exists`), so equal times are never "in order".
 */
export const inOrder = (time: string, above: string | null | undefined, below: string | null | undefined): boolean =>
	(above == null || above < time) && (below == null || below > time);

/** Where a timed entry goes among `spans`: before the first with a later time; `spans.length` when none is later. */
export function timePlace(spans: readonly Pick<EntrySpan, 'time'>[], time: string): number {
	const later = spans.findIndex((s) => s.time !== null && s.time > time);
	return later < 0 ? spans.length : later;
}

/**
 * The places entry `from` may be dropped in, as 0..n (before entry i, or n for the end of the day). `from` and `from + 1`
 * are where it already is, so they are always given, as "no move". An entry with no time may go anywhere else; one with a
 * time only where the timed entries stay in time order (`inOrder`).
 */
export function placesFor(spans: readonly Pick<EntrySpan, 'time'>[], from: number): number[] {
	const time = spans[from]?.time ?? null;
	const places: number[] = [];
	for (let place = 0; place <= spans.length; place += 1) {
		if (place === from || place === from + 1 || time === null) {
			places.push(place);
			continue;
		}
		const above = spans.slice(0, place).filter((e, i) => i !== from && e.time !== null).at(-1)?.time;
		const below = spans.slice(place).find((e, i) => i + place !== from && e.time !== null)?.time;
		if (inOrder(time, above, below)) places.push(place);
	}
	return places;
}

/** Whether a day has writing: any block other than its date line, which leads the file. */
export const hasWriting = (blocks: readonly Pick<EntryBlock, 'text'>[]): boolean =>
	blocks.some((b, i) => !(i === 0 && b.text.startsWith('# ')));

/** One entry of a day: its id (its heading's key), its time and title, and where its heading starts. */
export interface EntryRef {
	id: string;
	time: string | null;
	title: string | null;
	start: number;
}

/**
 * The day's entries, in the file's order. An entry's id is its heading block's key (`keyedBlocks`): what the bot names an
 * entry by, apart from its time, so an entry with no time, or two at one time, are named all the same (GM, 2026-11-09).
 */
export function entriesOf(text: string): EntryRef[] {
	return entrySpansOf(text).map((e) => ({ id: e.id, time: e.time, title: e.title, start: e.blocks[0]!.start }));
}
