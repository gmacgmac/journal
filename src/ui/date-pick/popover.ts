// A small floating panel opened from a button: placed under it (or over it, when there is more room there), held inside
// a boundary element, and closed by Escape, a press outside it, focus leaving it, its `scroller` scrolling, or the caller. Focus goes back to the
// button when the person closes it from the keyboard or with the button; a press elsewhere leaves focus where it went.
// Positions are set through the CSSOM (`style.top`), which a strict content security policy allows. Imports nothing.

export type CloseReason = 'pick' | 'escape' | 'outside' | 'toggle' | 'api';

export interface PopoverOptions {
	/** The button that opens it: it says whether the panel is open (`aria-expanded`) and gets focus back. */
	anchor: HTMLElement;
	content: HTMLElement;
	/** The element it stays inside; it must be a positioned element (the panel is placed in its coordinates). */
	boundary: HTMLElement;
	/** Which edge of the button the panel lines up with. */
	align?: 'start' | 'end' | 'center';
	/** The panel's accessible name. */
	label: string;
	/** A class for the panel, beside `dp-popover`. */
	className?: string;
	/** An element whose scrolling moves the anchor away from the panel: a scroll there closes it. */
	scroller?: HTMLElement;
	onClose?(reason: CloseReason): void;
}

export interface Popover {
	readonly el: HTMLElement;
	readonly open: boolean;
	close(reason?: CloseReason): void;
	/** Places it again (after its content changed size). */
	place(): void;
}

/** The space kept between the panel and the boundary's edges, and between it and its button. */
const EDGE = 8;
const GAP = 6;
let ids = 0;

export function openPopover(o: PopoverOptions): Popover {
	const doc = o.anchor.ownerDocument;
	const el = doc.createElement('div');
	el.className = o.className === undefined ? 'dp-popover' : `dp-popover ${o.className}`;
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-label', o.label);
	const id = `dp-popover-${(ids += 1)}`;
	el.setAttribute('id', id);
	el.append(o.content);
	o.boundary.append(el);
	o.anchor.setAttribute('aria-expanded', 'true');
	o.anchor.setAttribute('aria-controls', id);
	let open = true;
	const listening = new AbortController();
	const { signal } = listening;

	function place(): void {
		const a = o.anchor.getBoundingClientRect();
		const b = o.boundary.getBoundingClientRect();
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		const x = o.align === 'end' ? a.right - w : o.align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
		const below = b.bottom - a.bottom;
		const above = a.top - b.top;
		const y = below < h + GAP + EDGE && above > below ? a.top - GAP - h : a.bottom + GAP;
		el.style.left = `${Math.max(EDGE, Math.min(x - b.left, b.width - w - EDGE)) + o.boundary.scrollLeft}px`;
		el.style.top = `${y - b.top + o.boundary.scrollTop}px`;
	}

	function close(reason: CloseReason = 'api'): void {
		if (!open) return;
		open = false;
		listening.abort();
		const hadFocus = el.contains(doc.activeElement);
		el.remove();
		o.anchor.setAttribute('aria-expanded', 'false');
		o.anchor.removeAttribute('aria-controls');
		if (reason === 'escape' || reason === 'toggle' || (reason === 'api' && hadFocus)) o.anchor.focus();
		o.onClose?.(reason);
	}

	el.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		close('escape');
	}, { signal });
	// A press anywhere but the panel and its button closes it; the button's own press is the caller's toggle.
	doc.addEventListener('pointerdown', (e) => {
		const t = e.target as Node | null;
		if (t !== null && (el.contains(t) || o.anchor.contains(t))) return;
		close('outside');
	}, { capture: true, signal });
	o.scroller?.addEventListener('scroll', () => close('outside'), { passive: true, signal });
	el.addEventListener('focusout', (e) => {
		const to = e.relatedTarget as Node | null;
		if (to !== null && !el.contains(to) && !o.anchor.contains(to)) close('outside');
	}, { signal });

	place();
	return { el, get open() { return open; }, close, place };
}
