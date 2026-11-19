// DRAG TO REORDER (GM, 2026-11-19). An entry with no time has a handle in the margin, quiet until its heading is pointed
// at (a timed entry's place is its time, so it has none). Pressing the handle and moving lifts the entry: a copy follows
// the pointer, the entry's place goes faint, and a line shows where it will land, only in slots that keep the timed
// entries in time order (`move.ts`). The paper scrolls by itself near its top and foot. Letting go saves one edit
// (undoable), then every block that moved glides from where it was to where it now is, the moved entry from where it
// was let go. Esc, a cancelled or lost pointer, the window losing focus, or the day changing underneath puts it back.
// From the keyboard the handle is a button: Space or Enter lifts, ↑ ↓ choose the place, Space or Enter drops, Esc puts it
// back; each step is said through a polite live region. No dependency: pointer events, rects and the Web Animations API.
import { entrySpans, placesFor, type EntrySpan } from '../format/index.ts';
import { writingOf } from './days.ts';
import { el } from './render.ts';
import { entryName, isStill, moveEditOf } from './move.ts';
import type { BlockNode, Page } from './session.ts';
import type { Block, Day, RangeEdit } from './wire.ts';
import { say } from './words.ts';

/** How far, in pixels, a press moves before it is a drag (a press that stays is a click on the handle). */
const LIFT_PX = 4;
/** How near the paper's top or foot, in pixels, the paper scrolls by itself, and its fastest step per frame. */
const EDGE_PX = 64;
const SCROLL_MAX = 18;
/** The glide into place. */
const SETTLE = { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

export interface DragDeps {
	root: HTMLElement;
	paper: HTMLElement;
	sheet: HTMLElement;
	page: Page;
	day(date: string): Day | undefined;
	undo(u: RangeEdit, label: string): void;
	live: { readonly on: boolean };
}

interface Group {
	nodes: BlockNode[];
	rect: DOMRect;
}

interface Lift {
	date: string;
	section: HTMLElement;
	entries: EntrySpan<Block>[];
	from: number;
	slots: number[];
	slot: number;
	source: BlockNode[];
	/** The copy under the pointer; none for the keys. */
	ghost: HTMLElement | null;
	line: HTMLElement;
	/** How far below the copy's top the pointer holds it, and where the pointer is (viewport y). */
	grabY: number;
	pointerY: number;
	keys: boolean;
	frame: number;
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Union of the rects of `nodes`. */
function rectOf(nodes: Element[]): DOMRect {
	const rs = nodes.map((n) => n.getBoundingClientRect());
	const top = Math.min(...rs.map((r) => r.top));
	const left = Math.min(...rs.map((r) => r.left));
	return new DOMRect(left, top, Math.max(...rs.map((r) => r.right)) - left, Math.max(...rs.map((r) => r.bottom)) - top);
}

/** The entries of `section` as drawn: each heading with the blocks under it, in the page's order (drafts left out). */
function groupsOf(section: HTMLElement): Group[] {
	const groups: BlockNode[][] = [];
	for (const node of section.querySelectorAll<BlockNode>(':scope .entries > .block:not(.draft)')) {
		if (node.classList.contains('entry-head')) groups.push([node]);
		else groups.at(-1)?.push(node);
	}
	return groups.map((nodes) => ({ nodes, rect: rectOf(nodes) }));
}

/** The y, in the viewport, of the line for `slot`: midway in the room between the entries either side. */
function lineY(groups: Group[], slot: number): number {
	if (slot === 0) return groups[0]!.rect.top - 6;
	if (slot >= groups.length) return groups.at(-1)!.rect.bottom + 6;
	return (groups[slot - 1]!.rect.bottom + groups[slot]!.rect.top) / 2;
}

/** The place, 0 to n − 1, an entry dropped from `from` into `slot` ends up in. */
const placeOf = (from: number, slot: number): number => (isStill(from, slot) ? from : slot > from ? slot - 1 : slot);

/** A copy of `source` to ride under the pointer: never focusable, never found as a block of the page. */
function copyOf(source: BlockNode[], width: number): HTMLElement {
	const copy = el('div', source.map((n) => {
		const c = n.cloneNode(true) as HTMLElement;
		c.removeAttribute('data-key');
		c.removeAttribute('tabindex');
		return c;
	}), { class: 'entries' });
	copy.style.width = `${width}px`;
	const ghost = el('div', [copy], { class: 'drag-ghost', 'aria-hidden': 'true' });
	ghost.inert = true;
	return ghost;
}

export function createDrag(d: DragDeps) {
	const { root, paper, sheet, page } = d;
	const voice = el('div', [], { class: 'journal-voice', 'aria-live': 'polite', role: 'status' });
	root.append(voice);
	let lift: Lift | null = null;
	let press: { handle: HTMLElement; y: number; x: number; id: number } | null = null;
	const listening = new AbortController();
	const on = { signal: listening.signal };

	const tell = (text: string) => void (voice.textContent = text);
	const columnOf = (l: Lift) => l.section.querySelector<HTMLElement>('.entries')!.getBoundingClientRect();
	/** The lift no longer matches the page (the day was drawn again under it): it can only be put back. */
	const gone = (l: Lift) => !l.section.isConnected || l.source.some((n) => !n.isConnected);

	/** The entry the handle belongs to, ready to lift; null when it cannot be (a broken day, writing open, a page out of step). */
	function ready(handle: HTMLElement): Pick<Lift, 'date' | 'section' | 'entries' | 'from' | 'slots' | 'source'> | null {
		const head = handle.closest<BlockNode>('.entry-head');
		const section = handle.closest<HTMLElement>('.day');
		if (head === null || section === null || section.classList.contains('broken')) return null;
		// Writing open anywhere is saved first; the drag waits for the next press, on the page as it then is.
		if (page.sessions.current !== null) return void page.sessions.current.finish({ then: 'stay' }), null;
		const date = section.dataset.date!;
		const day = d.day(date);
		if (day === undefined) return null;
		const entries = entrySpans(writingOf(day));
		const groups = groupsOf(section);
		// The page and the day it was drawn from must agree, entry for entry.
		if (groups.length !== entries.length || groups.some((g, i) => g.nodes[0]!.dataset.key !== entries[i]!.id)) return null;
		const from = groups.findIndex((g) => g.nodes[0] === head);
		if (from < 0) return null;
		return { date, section, entries, from, slots: placesFor(entries, from), source: groups[from]!.nodes };
	}

	function begin(handle: HTMLElement, pointerY: number | null): boolean {
		const r = ready(handle);
		if (r === null) return false;
		const line = el('div', [], { class: 'drop-line', 'aria-hidden': 'true' });
		root.append(line);
		const keys = pointerY === null;
		const ghost = keys ? null : copyOf(r.source, r.section.querySelector<HTMLElement>('.entries')!.getBoundingClientRect().width);
		if (ghost !== null) root.append(ghost);
		const y = pointerY ?? 0;
		lift = { ...r, slot: r.from, ghost, line, grabY: y - rectOf(r.source).top, pointerY: y, keys, frame: 0 };
		for (const n of r.source) n.classList.add('drag-source');
		root.classList.add('dragging');
		show();
		if (keys) tell(say('journal.view.move.lifted', { entry: entryName(r.entries[r.from]!), n: r.from + 1, count: r.entries.length }));
		else lift.frame = requestAnimationFrame(tick);
		return true;
	}

	/** Draws the copy at the pointer, picks the nearest slot (the keys pick their own), and puts the line there. */
	function show(): void {
		const l = lift;
		if (l === null) return;
		if (gone(l)) return cancel();
		const groups = groupsOf(l.section);
		const base = root.getBoundingClientRect();
		const column = columnOf(l);
		if (l.ghost !== null) {
			l.ghost.style.transform = `translate(${column.left - base.left}px, ${l.pointerY - l.grabY - base.top}px)`;
			let far = Infinity;
			for (const slot of l.slots) {
				const gap = Math.abs(lineY(groups, slot) - l.pointerY);
				if (gap < far) [l.slot, far] = [slot, gap];
			}
		}
		const still = isStill(l.from, l.slot);
		l.line.hidden = still;
		if (still) return;
		l.line.style.transform = `translate(${column.left - base.left}px, ${lineY(groups, l.slot) - base.top}px)`;
		l.line.style.width = `${column.width}px`;
	}

	/** While a pointer drags: the paper scrolls near its edges, faster the nearer (the scroll redraws, below). */
	function tick(): void {
		const l = lift;
		if (l === null || l.keys) return;
		const box = paper.getBoundingClientRect();
		const y = l.pointerY;
		const near = y < box.top + EDGE_PX ? y - (box.top + EDGE_PX) : y > box.bottom - EDGE_PX ? y - (box.bottom - EDGE_PX) : 0;
		if (near !== 0) paper.scrollTop += Math.sign(near) * Math.min(SCROLL_MAX, Math.ceil((Math.abs(near) / EDGE_PX) ** 2 * SCROLL_MAX));
		l.frame = requestAnimationFrame(tick);
	}

	/** Takes down what the lift put up, all but the faint source (`keepSource`, while a drop is saving). */
	function clear(l: Lift, keepSource = false): void {
		cancelAnimationFrame(l.frame);
		if (!keepSource) for (const n of l.source) n.classList.remove('drag-source');
		l.line.remove();
		root.classList.remove('dragging');
		if (lift === l) lift = null;
		press = null;
	}

	/** Puts the entry back: the copy glides home, then goes. */
	function cancel(said = true): void {
		const l = lift;
		if (l === null) return void (press = null);
		clear(l);
		if (said && l.keys) tell(say('journal.view.move.cancelled'));
		const ghost = l.ghost;
		if (ghost === null) return;
		if (gone(l) || reduced() || typeof ghost.animate !== 'function') return ghost.remove();
		const base = root.getBoundingClientRect();
		const home = `translate(${columnOf(l).left - base.left}px, ${rectOf(l.source).top - base.top}px)`;
		ghost.animate([{ transform: ghost.style.transform }, { transform: home }], { ...SETTLE, fill: 'forwards' });
		// Taken off by the clock, not the animation's end: a page in the background may never finish it.
		setTimeout(() => ghost.remove(), SETTLE.duration + 40);
	}

	/** Lets go: one edit, then every block glides from where it was to where it is. */
	async function drop(): Promise<void> {
		const l = lift;
		if (l === null) return;
		const edit = gone(l) ? null : moveEditOf(l.date, l.entries, l.from, l.slot);
		if (edit === null) return cancel(false);
		// Where every block is now: the moved entry where its copy was let go.
		const before = new Map<Element, DOMRect>();
		for (const g of groupsOf(l.section)) for (const n of g.nodes) before.set(n, n.getBoundingClientRect());
		const copies = [...(l.ghost?.querySelectorAll(':scope > .entries > .block') ?? [])];
		l.source.forEach((n, i) => copies[i] !== undefined && before.set(n, copies[i]!.getBoundingClientRect()));
		clear(l, true);
		const r = await page.edit(edit);
		l.ghost?.remove();
		for (const n of l.source) n.classList.remove('drag-source');
		if (!d.live.on) return;
		if (r.day) page.patch(r.day, false);
		if (!r.ok) return page.notify(r.reason);
		d.undo(r.undo, say('journal.view.move.moved'));
		if (l.keys) tell(say('journal.view.move.dropped', { entry: entryName(l.entries[l.from]!), n: placeOf(l.from, l.slot) + 1, count: l.entries.length }));
		settle(l.section, before);
		// The handle keeps focus after a drop from the keys, so the next move is a key away.
		if (l.keys) sheet.querySelector<HTMLElement>(`.block[data-date="${l.date}"][data-key="${l.entries[l.from]!.id}"] .drag-handle`)?.focus();
	}

	/** Each block that moved glides from its old place to its new one (FLIP). */
	function settle(section: HTMLElement, before: Map<Element, DOMRect>): void {
		if (reduced()) return;
		for (const [node, was] of before) {
			if (!section.contains(node) || typeof (node as HTMLElement).animate !== 'function') continue;
			const now = node.getBoundingClientRect();
			const dx = was.left - now.left;
			const dy = was.top - now.top;
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
			(node as HTMLElement).animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], SETTLE);
		}
	}

	// ─── The pointer ───────────────────────────────────────────────────────────────────────────────────────────────
	sheet.addEventListener('pointerdown', (e) => {
		const handle = (e.target as Element).closest<HTMLElement>('.drag-handle');
		if (handle === null || e.button !== 0 || lift !== null) return;
		e.preventDefault();
		press = { handle, x: e.clientX, y: e.clientY, id: e.pointerId };
		handle.setPointerCapture?.(e.pointerId);
	}, on);
	sheet.addEventListener('pointermove', (e) => {
		if (press === null || e.pointerId !== press.id) return;
		// The button came up somewhere this page never heard (another window): put it back.
		if (e.buttons === 0) return cancel();
		if (lift === null) {
			if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < LIFT_PX) return;
			if (!begin(press.handle, press.y)) return void (press = null);
		}
		lift!.pointerY = e.clientY;
		show();
	}, on);
	const up = (e: PointerEvent) => {
		if (press === null || e.pointerId !== press.id) return;
		const pointer = lift !== null && !lift.keys;
		press = null;
		if (pointer) void (e.type === 'pointerup' ? drop() : cancel());
	};
	sheet.addEventListener('pointerup', up, on);
	sheet.addEventListener('pointercancel', up, on);
	sheet.addEventListener('lostpointercapture', up, on);
	// The window losing focus mid-drag (⌘-Tab) never hears the button come up: put it back.
	if (typeof window.addEventListener === 'function') window.addEventListener('blur', () => cancel(), on);
	// A scroll moves the entries under a still pointer or a chosen slot: draw again.
	paper.addEventListener('scroll', () => void (lift !== null && show()), { ...on, passive: true });

	// ─── The keys ──────────────────────────────────────────────────────────────────────────────────────────────────
	sheet.addEventListener('keydown', (e) => {
		if (lift !== null && e.key === 'Escape') {
			e.preventDefault();
			return cancel();
		}
		const handle = (e.target as Element).closest?.('.drag-handle') as HTMLElement | null;
		if (handle === null) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (lift === null) void begin(handle, null);
			else if (lift.keys) void drop();
			return;
		}
		const l = lift;
		if (l === null || !l.keys || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		// ↑ ↓ step through the places it may end up (its own among them).
		const places = [...new Set(l.slots.map((s) => placeOf(l.from, s)))].sort((a, b) => a - b);
		const here = places.indexOf(placeOf(l.from, l.slot));
		const to = places[Math.max(0, Math.min(places.length - 1, here + (e.key === 'ArrowUp' ? -1 : 1)))]!;
		l.slot = to === l.from ? l.from : to > l.from ? to + 1 : to;
		// Scrolled first, so the line is drawn where the entries then are.
		groupsOf(l.section)[to]?.nodes[0]?.scrollIntoView({ block: 'nearest' });
		show();
		tell(say('journal.view.move.over', { n: to + 1, count: l.entries.length }));
	}, on);
	sheet.addEventListener('focusout', (e) => {
		if (lift?.keys && (e.target as Element).closest?.('.drag-handle') !== null) cancel();
	}, on);

	return {
		/** Whether a press or a lift is under way (the sheet's own keys wait). */
		get busy() { return lift !== null || press !== null; },
		dispose() {
			if (lift !== null) {
				lift.ghost?.remove();
				clear(lift);
			}
			press = null;
			listening.abort();
			voice.remove();
		},
	};
}
