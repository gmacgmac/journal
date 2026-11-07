/**
 * Where each opener of the inline scanner closes, worked out once per text
 * (REVIEW_03 S1). Searching to the end from every opener that never closes
 * made 80,000 `[` take seconds; these tables make every lookup cheap.
 */

import { runLength } from './chars.ts';

/**
 * For every `open` character in `text`, the index of the `close` that balances
 * it, or -1 — built in two linear passes. Depth-counted, so a URL containing a
 * balanced pair — `(https://example.com/a_(b))` — closes where the author meant.
 *
 * A backslash hides the character after it. The pairing of backslashes is taken
 * from the start of the text; scanning from any opener agrees with it past that
 * opener, because an opener is not a backslash and so leaves no escape pending.
 * The closer of the opener at `o` is then the first index after `o` where the
 * running depth falls one below its value at `o`, found by a pass from the right.
 */
export function closerTable(text: string, open: string, close: string): Int32Array {
	const n = text.length;
	const level = new Int32Array(n);
	let depth = 0;
	for (let i = 0; i < n; i += 1) {
		const ch = text[i];
		if (ch === '\\') {
			level[i] = depth;
			if (i + 1 < n) level[i + 1] = depth;
			i += 1;
			continue;
		}
		if (ch === open) depth += 1;
		else if (ch === close) depth -= 1;
		level[i] = depth;
	}
	// Depth spans -n..n; `nearest[d + n]` is the smallest index seen so far at depth d.
	const nearest = new Int32Array(2 * n + 2).fill(-1);
	const closer = new Int32Array(n).fill(-1);
	for (let i = n - 1; i >= 0; i -= 1) {
		if (text[i] === open) closer[i] = nearest[level[i]! - 1 + n]!;
		nearest[level[i]! + n] = i;
	}
	return closer;
}

/** Where every run of backticks in a text starts, by the run's exact length, in order. */
export type BacktickRuns = Map<number, number[]>;

/**
 * Every run of backticks, by length. Code spans take no escapes, so a run is
 * simply as many backticks as stand together — the same runs a scan from any
 * point just past a run would find.
 */
export function backtickRuns(text: string): BacktickRuns {
	const runs: BacktickRuns = new Map();
	let i = text.indexOf('`');
	while (i !== -1) {
		const n = runLength(text, i, '`');
		const starts = runs.get(n);
		if (starts === undefined) runs.set(n, [i]);
		else starts.push(i);
		i = text.indexOf('`', i + n);
	}
	return runs;
}

/**
 * Index of the next run of EXACTLY `n` backticks at or after `from`, or -1.
 * `from` is just past the opening run, so it never falls inside a run.
 */
export function findCodeClose(runs: BacktickRuns, from: number, n: number): number {
	const starts = runs.get(n);
	if (starts === undefined) return -1;
	let lo = 0;
	let hi = starts.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (starts[mid]! < from) lo = mid + 1;
		else hi = mid;
	}
	return lo < starts.length ? starts[lo]! : -1;
}
