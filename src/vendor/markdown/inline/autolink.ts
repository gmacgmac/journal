/** The bare-URL rule: where an `http(s)://` or `www.` address in text starts and stops. */

import { isPunct, isSpace } from './chars.ts';

/**
 * What a bare URL sheds from its end: sentence punctuation, quotes and the
 * emphasis marks — a URL is far more often the end of a sentence or of a
 * `**bold**` run than it is a path ending in `.` or `_`. The backtick is for
 * `linkify`, which sees `` `https://x` `` as text. A `)` is separate: it
 * stays when the URL opened it (see {@link autolink}).
 */
const URL_TRAILING = new Set('.,;:!?\'"*_~`');

/** What may follow a `www.` host for the address to continue past it. */
const HOST_TAIL = new Set('/?#');

/** A bare URL found in text: where it stops, and what it links to. */
export interface Autolink {
	/** The index just past the URL; its text is `text.slice(at, end)`. */
	end: number;
	/** The text, plus the `https://` a `www.` address left out. */
	href: string;
}

/** What the label walk from one label start found; `null` when a label on the way is not one. */
interface HostWalk {
	/** Just past the last label. */
	end: number;
	/** Labels from this start to the end, counted up to 2 — all the rule asks. */
	labels: number;
	/** Whether the last label is letters only and at least two long. */
	lastOk: boolean;
}

/**
 * Each label start's walk, for one text. One scan of a text makes one, so a
 * run like `www.www.www.…` is walked once rather than once per `www.` in it
 * (REVIEW_03 S1: 20,000 of them took 12 s).
 */
export type HostMemo = Map<number, HostWalk | null>;

/**
 * The bare URL that starts at `at`, or `null` if none does.
 *
 * One rule shared by `scanInline` and `linkify`, so the two agree
 * on where a URL ends. A URL starts at a word boundary — `nothttps://x` is a
 * word — with `http(s)://` or with `www.` and a host ({@link hostEnd}). The
 * scheme form runs to whitespace or `<`; the `www.` form stops at its host
 * unless {@link HOST_TAIL} continues it, so `www.example.com,` and
 * `www.example.com:8080` both end at the host. The end sheds
 * {@link URL_TRAILING}, and a `)` that no `(` inside the URL opened, so
 * `(https://x/a_(b))` keeps the inner pair and gives the outer one back to
 * the sentence.
 */
export function autolink(text: string, at: number, hosts: HostMemo): Autolink | null {
	const ch = text[at];
	if (ch !== 'h' && ch !== 'H' && ch !== 'w' && ch !== 'W') return null;
	const before = text[at - 1];
	if (!isSpace(before) && !isPunct(before)) return null;
	const head = text.slice(at, at + 8).toLowerCase();
	const scheme = head.startsWith('https://') ? 8 : head.startsWith('http://') ? 7 : 0;
	// The shortest the URL may be trimmed to: past the scheme, or the host.
	const floor = scheme > 0 ? at + scheme : head.startsWith('www.') ? hostEnd(text, at + 4, hosts) : -1;
	if (floor === -1) return null;
	let end = floor;
	if (scheme > 0 || HOST_TAIL.has(text[end] ?? '')) {
		while (end < text.length && !isSpace(text[end]) && text[end] !== '<') end += 1;
	}
	// Counted once and kept as the end moves: recounting at each trailing `)`
	// was quadratic (REVIEW_03 S1).
	let depth = parenDepth(text, at, end);
	while (end > floor) {
		const last = text[end - 1]!;
		if (URL_TRAILING.has(last)) end -= 1;
		else if (last === ')' && depth < 0) {
			end -= 1;
			depth += 1;
		} else break;
	}
	// A scheme with nothing after it is text; a host by itself is an address.
	if (scheme > 0 && end === floor) return null;
	const typed = text.slice(at, end);
	return { end, href: scheme > 0 ? typed : `https://${typed}` };
}

/**
 * The index just past the dotted host starting at `from`, or -1 if what is
 * there is not one: labels of letters, digits and `-` (neither first nor
 * last) joined by single dots, at least two of them, the last one letters
 * only and at least two long — the industry grammar, so `www.final.txt` is
 * a host and `www.example.c0m` is not. An empty label has no place in it,
 * so `www.a..b.com` — text that looks like a traversal — never matches, and
 * `www.x` does not either: one label is a word, not a host.
 *
 * The walk from a label start depends on nothing before it, so each one is
 * kept in `hosts` and a later `www.` inside the same run reuses it.
 */
function hostEnd(text: string, from: number, hosts: HostMemo): number {
	const path: number[] = [];
	let at = from;
	let walk = hosts.get(at);
	while (walk === undefined) {
		let n = 0;
		while (isLabelChar(text[at + n])) n += 1;
		const label = text.slice(at, at + n);
		if (n === 0 || label.startsWith('-') || label.endsWith('-')) walk = null;
		else if (text[at + n] === '.' && isLabelChar(text[at + n + 1])) {
			path.push(at);
			at += n + 1;
			walk = hosts.get(at);
			continue;
		} else walk = { end: at + n, labels: 1, lastOk: /^[A-Za-z]{2,}$/.test(label) };
		hosts.set(at, walk);
	}
	// Back along the labels walked: each one is one more label before the same end.
	for (let k = path.length - 1; k >= 0; k -= 1) {
		if (walk !== null) walk = { ...walk, labels: Math.min(2, walk.labels + 1) };
		hosts.set(path[k]!, walk);
	}
	return walk !== null && walk.labels >= 2 && walk.lastOk ? walk.end : -1;
}

function isLabelChar(ch: string | undefined): boolean {
	return ch !== undefined && /^[A-Za-z0-9-]$/.test(ch);
}

/** Opens minus closes in `text[from, to)` — negative means a `)` too many. */
function parenDepth(text: string, from: number, to: number): number {
	let depth = 0;
	for (let i = from; i < to; i += 1) {
		if (text[i] === '(') depth += 1;
		else if (text[i] === ')') depth -= 1;
	}
	return depth;
}
