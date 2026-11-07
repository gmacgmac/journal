// `resolve(kind, ref)`: what a chip says now, as the message goes, or why it cannot go (docs/specification/plugin.md
// § Resolve). Every ref shape the Journal has made is answered or refused; nothing here throws.
import { CHIP_LIMITS, type ChipRefusal, type ResolveAnswer } from '../vendor/plugin-host/plugin-host.ts';
import {
	CHIP_DAYS, CHIP_TEXT_CHARS, KEY_RE, addDays, dateTitle, daysBetween, entryOf, isDate, keyedBlocks, rangeParts,
} from '../format/index.ts';
import type { BlockRef, DaysRef } from '../seam-types.ts';
import { readDayFile } from '../store/index.ts';
import { word } from './words.ts';

/** An entry's name in a `where`, at most this long, so `where` stays inside the contract's bounds. */
const ENTRY_CHARS = 200;

const gone = (): ChipRefusal => ({ refused: 'gone', reason: word('journal.chip.gone') });
const tooLong = (): ChipRefusal => ({ refused: 'too-long', reason: word('journal.chip.too-long') });

/** `ref` as an object holding exactly `keys`, each a string; null for any other shape. */
function shaped<K extends string>(ref: unknown, keys: readonly K[]): Record<K, string> | null {
	if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) return null;
	const own = Object.keys(ref);
	if (own.length !== keys.length || !keys.every((k) => own.includes(k) && typeof (ref as Record<string, unknown>)[k] === 'string')) return null;
	return ref as Record<K, string>;
}

const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

function block(dir: string, ref: unknown): ResolveAnswer {
	const r = shaped<keyof BlockRef>(ref, ['date', 'key']);
	if (r === null || !isDate(r.date) || !KEY_RE.test(r.key)) return gone();
	const file = readDayFile(dir, r.date);
	if (file.state !== 'text') return gone();
	const blocks = keyedBlocks(file.text);
	const at = blocks.findIndex((b) => b.key === r.key);
	if (at < 0) return gone();
	const text = blocks[at]!.text;
	if (text.length > CHIP_LIMITS.textChars) return tooLong();
	const title = dateTitle(r.date);
	for (let i = at; i > 0; i -= 1) {
		if (entryOf(blocks[i]!.text) !== null) {
			return { where: word('journal.chip.where-block', { title, entry: cut(blocks[i]!.text.slice(3), ENTRY_CHARS) }), text };
		}
	}
	return { where: word('journal.chip.where-day', { title }), text };
}

function days(dir: string, ref: unknown): ResolveAnswer {
	const r = shaped<keyof DaysRef>(ref, ['from', 'to']);
	if (r === null || !isDate(r.from) || !isDate(r.to)) return gone();
	const n = daysBetween(r.from, r.to);
	if (n === 0) return gone();
	if (n > CHIP_DAYS) return tooLong();
	const texts: string[] = [];
	let chars = 0;
	for (let date = r.from; date <= r.to; date = addDays(date, 1)) {
		const file = readDayFile(dir, date);
		if (file.state === 'too-big') return tooLong();
		if (file.state !== 'text') continue;
		const text = file.text.trimEnd();
		chars += text.length + (texts.length > 0 ? 2 : 0);
		if (chars > CHIP_TEXT_CHARS) return tooLong();
		texts.push(text);
	}
	const where = r.from === r.to
		? word('journal.chip.where-day', { title: dateTitle(r.from) })
		: word('journal.chip.where-days', rangeParts(r.from, r.to));
	return { where, text: texts.join('\n\n') };
}

/** The resolver over the data folder `dir`. A failure to read is `warn`ed and the chip is refused `gone`. */
export function createResolve(dir: string, warn: (message: string) => void): (kind: string, ref: unknown) => ResolveAnswer {
	return (kind, ref) => {
		try {
			if (kind === 'block') return block(dir, ref);
			if (kind === 'days') return days(dir, ref);
			return gone();
		} catch (e) {
			warn(`journal: resolve ${String(kind).slice(0, 64)} failed: ${(e as Error).message}`);
			return gone();
		}
	};
}
