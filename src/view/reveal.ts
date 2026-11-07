// What `reveal(ref)` is asked to show. A ref comes back from a change line or a sent chip, possibly long after it was
// made, so every shape the Journal has ever made is read here (spec § References), and anything else is refused,
// never thrown at:
//   { date }         an event, or a change line whose block went
//   { date, key }    a block chip, or a change line
//   { from, to }     a days chip
import { isDate, KEY_RE } from '../format/index.ts';

export type Reveal = { date: string; key: string | null } | { from: string; to: string };

const keysAre = (ref: object, ...names: string[]) => {
	const keys = Object.keys(ref).sort();
	return keys.length === names.length && names.sort().every((n, i) => keys[i] === n);
};

/** The place `ref` names, or null when it is not a shape the Journal makes, or names no real day. */
export function readReveal(ref: unknown): Reveal | null {
	if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) return null;
	const r = ref as Record<string, unknown>;
	if (keysAre(r, 'date') && isDate(r.date)) return { date: r.date, key: null };
	if (keysAre(r, 'date', 'key') && isDate(r.date) && typeof r.key === 'string' && KEY_RE.test(r.key)) return { date: r.date, key: r.key };
	if (keysAre(r, 'from', 'to') && isDate(r.from) && isDate(r.to) && r.from <= r.to) return { from: r.from, to: r.to };
	return null;
}
