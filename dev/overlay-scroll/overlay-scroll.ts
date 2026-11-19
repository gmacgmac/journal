/**
 * THE OVERLAY SCROLLBAR, ONE FOR EVERY SCROLLING AREA (GM, 2026-10-24; mock-up `mockups/chat-composer`).
 *
 * The native scrollbar is hidden everywhere (`styles/overlay-scroll.css`) and this draws the replacement:
 * a thin thumb at the area's far right edge (the bottom edge, for a sideways scroll), no rail, shown while
 * the area scrolls and faded 0.8s after. Hovering the edge shows it too, and it can be dragged (GM: *"when
 * they hover over where the scroll bar is, then they should be able to drag it"*). The wheel, touch and the
 * keys scroll as they always did; the thumb is only a picture until it is shown, so it never takes a click.
 *
 * ONE LISTENER FOR THE WHOLE APP, not an action on each area: a scroll event does not bubble but does
 * capture, so `installOverlayScroll` (called once, by the layout) hears every scroller on the page, in a
 * dialog, a popover or a textarea, and draws one thumb per axis for whichever is moving. Nothing to
 * remember when an area is added.
 *
 * TWO ATTRIBUTES, both on the scroller: `data-scroll-track="<selector>"` runs the thumb along a sibling
 * box instead of the scroller itself (the composer's field: the thumb sits past the mic, on the box's edge),
 * and `data-overlay-off` keeps an area, and what is inside it, on no thumb (the settings tab strip hides
 * its own bar on purpose). The arithmetic is `overlay-scroll/geometry.ts`.
 */
import { dragTarget, overflows, thumbBox } from './geometry.ts';

type Axis = 'y' | 'x';

/** How long the thumb stays after the last scroll or pointer move. */
const IDLE_MS = 800;
/** How close to an area's edge the pointer shows its thumb. */
const NEAR = 14;
/** What the strip never takes a press from: a live control under it gets the press (the composer's mic at the field's foot). A text field is not one: it is the area the thumb belongs to. */
const CONTROL = ['a[href]', 'button:not(:disabled)', 'summary', '[role="button"]', '[role="link"]', '[role="menuitem"]'].join(',');
/** The fixed overlay's depth: above a dialog (z-index 60) and a popover. */
const LEVEL = '1000';

interface Box {
	start: number;
	end: number;
	cross: number;
	crossEnd: number;
}

interface Lane {
	axis: Axis;
	el: HTMLElement;
	scroller: HTMLElement | null;
	timer: ReturnType<typeof setTimeout> | null;
	hover: boolean;
	drag: { from: number; start: number } | null;
}

function overflowOf(el: Element, axis: Axis): string {
	const cs = getComputedStyle(el);
	return axis === 'y' ? cs.overflowY : cs.overflowX;
}

function sizes(el: HTMLElement, axis: Axis): { client: number; size: number; pos: number } {
	return axis === 'y'
		? { client: el.clientHeight, size: el.scrollHeight, pos: el.scrollTop }
		: { client: el.clientWidth, size: el.scrollWidth, pos: el.scrollLeft };
}

/** Does this element scroll along the axis, by its own style and by its content? */
function scrolls(el: HTMLElement, axis: Axis): boolean {
	const { client, size } = sizes(el, axis);
	// The page itself reports `visible` and scrolls anyway: the viewport takes it.
	const page = el === el.ownerDocument.scrollingElement;
	return overflows(client, size) && (page || /auto|scroll|overlay/.test(overflowOf(el, axis)));
}

/** The strip the thumb runs along, in viewport pixels. */
function boxOf(scroller: HTMLElement, root: HTMLElement | null): DOMRect | { left: number; right: number; top: number; bottom: number } {
	if (scroller === root) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
	const sel = scroller.dataset.scrollTrack;
	const track = sel ? scroller.parentElement?.querySelector(sel) : null;
	return (track ?? scroller).getBoundingClientRect();
}

export function installOverlayScroll(doc: Document = document): () => void {
	const win = doc.defaultView;
	if (win === null) return () => {};
	const root = doc.scrollingElement instanceof HTMLElement ? doc.scrollingElement : null;
	const lanes: Record<Axis, Lane> = { y: lane('y'), x: lane('x') };
	const lastPos = new WeakMap<Element, { top: number; left: number }>();

	function lane(axis: Axis): Lane {
		const el = doc.createElement('div');
		el.className = 'ui-overlay-thumb';
		el.dataset.axis = axis;
		el.setAttribute('aria-hidden', 'true');
		el.style.zIndex = LEVEL;
		doc.body.appendChild(el);
		return { axis, el, scroller: null, timer: null, hover: false, drag: null };
	}

	function geometry(l: Lane): { box: Box; length: number; offset: number; client: number; size: number; pos: number; track: number } | null {
		const scroller = l.scroller;
		if (scroller === null || !scrolls(scroller, l.axis)) return null;
		const rect = boxOf(scroller, root);
		const { client, size, pos } = sizes(scroller, l.axis);
		const vertical = l.axis === 'y';
		const track = vertical ? rect.bottom - rect.top : rect.right - rect.left;
		const { length, offset } = thumbBox(client, size, pos, track);
		const box: Box = vertical
			? { start: rect.top, end: rect.bottom, cross: rect.right, crossEnd: rect.left }
			: { start: rect.left, end: rect.right, cross: rect.bottom, crossEnd: rect.top };
		return { box, length, offset, client, size, pos, track };
	}

	function paint(l: Lane): void {
		const g = geometry(l);
		if (g === null) return void l.el.classList.remove('on');
		const vertical = l.axis === 'y';
		const style = l.el.style;
		// The hit strip is 12px wide and holds the 3px thumb at its far edge (CSS); it sits inside the area's edge.
		style[vertical ? 'height' : 'width'] = `${g.length}px`;
		style[vertical ? 'top' : 'left'] = `${g.box.start + g.offset}px`;
		style[vertical ? 'left' : 'top'] = `${g.box.cross - 12}px`;
	}

	/** Is a live control the topmost thing under the point, past the strips themselves? */
	function controlAt(x: number, y: number): boolean {
		for (const el of doc.elementsFromPoint(x, y)) {
			if (el === lanes.y.el || el === lanes.x.el) continue;
			return el.closest(CONTROL) !== null;
		}
		return false;
	}

	/** The strip lets a press through to a control under it (`.yield` is `pointer-events: none`) and takes it back when the pointer leaves that control. */
	function yieldTo(l: Lane, x: number, y: number): void {
		l.el.classList.toggle('yield', controlAt(x, y));
	}

	function rest(l: Lane): void {
		if (l.timer !== null) clearTimeout(l.timer);
		l.timer = setTimeout(() => {
			if (l.hover || l.drag !== null) return rest(l);
			l.el.classList.remove('on');
		}, IDLE_MS);
	}

	function show(axis: Axis, scroller: HTMLElement): void {
		const l = lanes[axis];
		if (l.drag !== null) return;
		l.scroller = scroller;
		if (geometry(l) === null) return;
		paint(l);
		l.el.classList.add('on');
		rest(l);
	}

	function scrollerOf(target: EventTarget | Document | null): HTMLElement | null {
		if (target === doc) return root;
		return target instanceof HTMLElement ? target : null;
	}

	function onScroll(event: Event): void {
		const scroller = scrollerOf(event.target);
		if (scroller === null || scroller.closest('[data-overlay-off]') !== null) return;
		const before = lastPos.get(scroller);
		lastPos.set(scroller, { top: scroller.scrollTop, left: scroller.scrollLeft });
		// Only the axis that moved: a vertical scroll must not flash the sideways thumb of the same box.
		if (before === undefined || before.top !== scroller.scrollTop) show('y', scroller);
		if (before === undefined || before.left !== scroller.scrollLeft) show('x', scroller);
	}

	let queued = false;
	let pointer: PointerEvent | null = null;

	/** Hovering an area's edge shows its thumb, innermost area first. */
	function look(): void {
		queued = false;
		const event = pointer;
		if (event === null) return;
		for (let el = event.target instanceof Element ? event.target : null; el !== null; el = el.parentElement) {
			if (!(el instanceof HTMLElement) || el.closest('[data-overlay-off]') !== null) continue;
			const scroller = el === doc.body || el === doc.documentElement ? root : el;
			if (scroller === null) continue;
			for (const axis of ['y', 'x'] as const) {
				if (!scrolls(scroller, axis)) continue;
				const rect = boxOf(scroller, root);
				const near = axis === 'y' ? rect.right - event.clientX : rect.bottom - event.clientY;
				if (near >= 0 && near <= NEAR) return show(axis, scroller);
			}
		}
	}

	function onMove(event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		for (const l of [lanes.y, lanes.x]) if (l.el.classList.contains('yield') && l.drag === null) yieldTo(l, event.clientX, event.clientY);
		if ((event.target as Element | null)?.classList?.contains('ui-overlay-thumb')) return;
		pointer = event;
		if (!queued) {
			queued = true;
			win!.requestAnimationFrame(look);
		}
	}

	function onResize(): void {
		for (const l of [lanes.y, lanes.x]) if (l.el.classList.contains('on')) paint(l);
	}
	/** A field that grows or shrinks as it is typed in moves no scroll position, so a shown thumb is repainted after the
	 *  field has taken its new height, and goes when it no longer scrolls (GM 2026-10-24: deleting text left the thumb
	 *  standing above the composer). */
	function onInput(): void {
		win!.requestAnimationFrame(onResize);
	}

	const stops: Array<() => void> = [];
	for (const l of [lanes.y, lanes.x]) {
		const enter = (): void => void (l.hover = true);
		const leave = (): void => {
			l.hover = false;
			rest(l);
		};
		const down = (event: PointerEvent): void => {
			const scroller = l.scroller;
			if (scroller === null) return;
			// A press with no move before it (the strip appeared under a still pointer): hand over from the next press.
			if (controlAt(event.clientX, event.clientY)) return yieldTo(l, event.clientX, event.clientY);
			event.preventDefault();
			l.el.setPointerCapture(event.pointerId);
			const vertical = l.axis === 'y';
			l.drag = { from: vertical ? event.clientY : event.clientX, start: sizes(scroller, l.axis).pos };
			l.el.classList.add('held');
		};
		const move = (event: PointerEvent): void => {
			const scroller = l.scroller;
			if (l.drag === null || scroller === null) return;
			const g = geometry(l);
			if (g === null) return;
			const moved = (l.axis === 'y' ? event.clientY : event.clientX) - l.drag.from;
			const to = dragTarget(l.drag.start, moved, g.client, g.size, g.track);
			if (l.axis === 'y') scroller.scrollTop = to;
			else scroller.scrollLeft = to;
			// The reader moved it, not a message arriving: `tail-follow/reader-input.ts` listens for this.
			scroller.dispatchEvent(new CustomEvent('overlaydrag'));
		};
		const up = (): void => {
			l.drag = null;
			l.el.classList.remove('held');
			rest(l);
		};
		const over = (event: PointerEvent): void => {
			if (l.drag === null) yieldTo(l, event.clientX, event.clientY);
		};
		l.el.addEventListener('pointerenter', enter);
		l.el.addEventListener('pointerenter', over);
		l.el.addEventListener('pointermove', over);
		l.el.addEventListener('pointerleave', leave);
		l.el.addEventListener('pointerdown', down);
		l.el.addEventListener('pointermove', move);
		l.el.addEventListener('pointerup', up);
		l.el.addEventListener('pointercancel', up);
		stops.push(() => {
			if (l.timer !== null) clearTimeout(l.timer);
			l.el.remove();
		});
	}
	doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
	doc.addEventListener('pointermove', onMove, { capture: true, passive: true });
	win.addEventListener('resize', onResize);
	doc.addEventListener('input', onInput, { capture: true, passive: true });
	return () => {
		doc.removeEventListener('scroll', onScroll, { capture: true });
		doc.removeEventListener('pointermove', onMove, { capture: true });
		win.removeEventListener('resize', onResize);
		doc.removeEventListener('input', onInput, { capture: true });
		for (const stop of stops) stop();
	};
}
