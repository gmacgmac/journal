// The Journal's two chips (spec § References): a `block` chip for one block's Add to chat, and the `days` chip
// `pageChip()` offers for the days on show. Each carries the plugin's id, its kind and a ref the engine's `resolve`
// answers, inside the contract's `CHIP_LIMITS`; the days chip never offers more than `resolve` takes.
import { CHIP_DAYS, CHIP_TEXT_CHARS, daysBetween } from '../format/index.ts';
import { PLUGIN_ID } from '../manifest.ts';
import { CHIP_LIMITS, type Chip } from '../vendor/plugin-host/plugin-host.ts';
import { dayMonth, shortDate, snippet, type Range } from './dates.ts';
import { entryHeadOf, type BlockNode } from './session.ts';
import type { Day } from './wire.ts';
import { say } from './words.ts';


const clamp = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The entry a block sits under, read from the page: its time and title, or null. */
export function entryOf(node: BlockNode): string | null {
	const head = entryHeadOf(node);
	return head === null ? null : (head._text ?? '').replace(/^##\s+/, '');
}

/** A saved block as a chip: `Sat 7 Nov · 21:30 · Walk`, its first words as the detail. */
export function blockChip(node: BlockNode, text: string): Chip {
	const date = node.dataset.date!;
	const entry = entryOf(node);
	const label = entry === null ? shortDate(date) : `${shortDate(date)} · ${entry}`;
	return {
		plugin: PLUGIN_ID,
		kind: 'block',
		ref: { date, key: node.dataset.key! },
		label: clamp(label, CHIP_LIMITS.labelChars),
		detail: clamp(snippet(text), CHIP_LIMITS.detailChars),
	};
}

/**
 * The characters `resolve` would send for these days, or more: each page's file (its last block's end, and its last line
 * end), a blank line between. A page whose size is not known (too big to read) counts as too much.
 */
function textChars(days: Iterable<Day>): number {
	let chars = 0;
	let pages = 0;
	for (const day of days) {
		if (!day.exists) continue;
		const last = day.blocks.at(-1);
		if (last === undefined && day.problems.length > 0) return Infinity;
		chars += last === undefined ? 0 : last.end + 1;
		pages += 1;
	}
	return chars + 2 * Math.max(0, pages - 1);
}

/** The days on show as one chip, `2 Nov – 8 Nov`; null when `resolve` would refuse it as too much. */
export function daysChip(range: Range, days: Iterable<Day>): Chip | null {
	const count = daysBetween(range.from, range.to);
	if (count < 1 || count > CHIP_DAYS || textChars(days) > CHIP_TEXT_CHARS) return null;
	return {
		plugin: PLUGIN_ID,
		kind: 'days',
		ref: { from: range.from, to: range.to },
		label: `${dayMonth(range.from)} – ${dayMonth(range.to)}`,
		detail: count === 1 ? say('journal.view.chip.day') : say('journal.view.chip.days', { count }),
	};
}
