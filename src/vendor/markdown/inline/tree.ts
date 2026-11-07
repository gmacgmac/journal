/** The inline tree while it is built: appending nodes, and the stack of open emphasis frames. */

import type { Inline } from '../types.ts';

/** An emphasis run that opened and has not closed yet. */
export interface Frame {
	char: string;
	len: number;
	marker: string;
	children: Inline[];
}

/** Append, merging runs of text so the tree has no adjacent text nodes. */
export function emit(into: Inline[], node: Inline): void {
	if (node.kind === 'text') {
		if (node.text === '') return;
		const last = into[into.length - 1];
		if (last !== undefined && last.kind === 'text') {
			last.text += node.text;
			return;
		}
	}
	into.push(node);
}

/**
 * The open frames, innermost last, indexed by character and width so a closer
 * finds its frame without walking the stack, and unwound in one pass — walking
 * and unwinding level by level were each quadratic (REVIEW_03 S1).
 */
export class FrameStack {
	readonly frames: Frame[] = [];
	readonly root: Inline[];
	/** Per `char + len`, the indexes in `frames` of those frames, innermost last. */
	readonly #open = new Map<string, number[]>();

	constructor(root: Inline[]) {
		this.root = root;
	}

	/** Where a node goes now: the innermost frame, or the root. */
	into(): Inline[] {
		return this.frames[this.frames.length - 1]?.children ?? this.root;
	}

	push(frame: Frame): void {
		const key = frame.char + frame.len;
		const at = this.#open.get(key);
		if (at === undefined) this.#open.set(key, [this.frames.length]);
		else at.push(this.frames.length);
		this.frames.push(frame);
	}

	pop(): Frame {
		const frame = this.frames.pop()!;
		this.#open.get(frame.char + frame.len)!.pop();
		return frame;
	}

	/** Index of the innermost frame of `char` no wider than `left`, or -1. Frames are 1 or 2 wide. */
	innermost(char: string, left: number): number {
		const one = this.#top(char + 1);
		return left >= 2 ? Math.max(one, this.#top(char + 2)) : one;
	}

	/**
	 * Unwind the frames above `keep`, their markers becoming literal text. All
	 * of them land in `keep`'s children (the root for -1) in order — marker,
	 * then children, frame after frame — which is what unwinding them one level
	 * at a time leaves, without moving each node once per level.
	 */
	dissolveAbove(keep: number): void {
		const parent = this.frames[keep]?.children ?? this.root;
		for (let k = keep + 1; k < this.frames.length; k += 1) {
			const frame = this.frames[k]!;
			emit(parent, { kind: 'text', text: frame.marker });
			for (const child of frame.children) emit(parent, child);
		}
		while (this.frames.length - 1 > keep) this.pop();
	}

	#top(key: string): number {
		const at = this.#open.get(key);
		return at === undefined || at.length === 0 ? -1 : at[at.length - 1]!;
	}
}
