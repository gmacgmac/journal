/**
 * THE OVERLAY SCROLLBAR'S ARITHMETIC (GM, 2026-10-24) — pure numbers in, pure numbers out, so the
 * controller (`../overlay-scroll.ts`) draws and listens and this file is what a test can hold.
 *
 * One axis at a time: `client` is the visible length of the scroller, `size` its whole scrollable length,
 * `track` the length of the strip the thumb runs along, `pos` how far it has scrolled.
 */

/** The shortest a thumb is drawn, so a very long page still leaves something to grab. */
export const MIN_THUMB = 24;
/** Room kept free at each end of the track. */
export const END_GAP = 4;

/** Does the scroller overflow by more than rounding? (`scrollHeight` is a whole number; a line is not.) */
export function overflows(client: number, size: number): boolean {
	return size > client + 1;
}

export interface ThumbBox {
	/** The thumb's length, along the axis. */
	length: number;
	/** Its distance from the track's start. */
	offset: number;
}

/** Where the thumb sits: its length is the visible share of the whole, its offset the scrolled share of what is left. */
export function thumbBox(client: number, size: number, pos: number, track: number): ThumbBox {
	const room = Math.max(0, track - 2 * END_GAP);
	const length = Math.min(room, Math.max(MIN_THUMB, (client / size) * room));
	const span = size - client;
	const share = span <= 0 ? 0 : Math.min(1, Math.max(0, pos / span));
	return { length, offset: END_GAP + share * (room - length) };
}

/** The scroll position a drag lands on: the thumb moved `moved` px from where it was grabbed at `from`. */
export function dragTarget(from: number, moved: number, client: number, size: number, track: number): number {
	const room = Math.max(0, track - 2 * END_GAP);
	const length = Math.min(room, Math.max(MIN_THUMB, (client / size) * room));
	const travel = room - length;
	const span = size - client;
	if (travel <= 0) return from;
	return Math.min(span, Math.max(0, from + (moved * span) / travel));
}
