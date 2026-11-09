// HOW FOCUS CAME, so the focus ring shows only for Tab (GM, 2026-11-09; the board's pointer focus,
// `apps/board/src/board/canvas/pointer-focus.ts`). A browser starts matching `:focus-visible` on any key, a modifier
// included, so a button pressed with the pointer lit up the moment Shift or ⌘ went down. Here, what focus lands on
// carries `data-pointer-focus` unless Tab moved it there, and the stylesheet draws no ring on it (`--journal-ring`). Focus
// that Tab moves never carries it, so a keyboard user always sees where they are (WCAG 2.4.7). Writing is left alone:
// there the ring says where typing goes.
//
// It hears presses on the mount's root, and Tab on the document, bubbling (spec § Keys: no capture-phase listener
// on the window or the document), so Tab from outside the root, into it, shows the ring too. Everything it knows lives in
// this call.
const ATTR = 'data-pointer-focus';
/** Where the ring says where typing goes. */
const TYPED = "[contenteditable='true'], input[type='text'], input[type='url'], input:not([type])";

export function trackFocusSource(root: HTMLElement): () => void {
	/** Whether the last input inside the root that could move focus was a pointer press (true) or Tab (false). */
	let pressed = false;
	const inside = (n: EventTarget | null) => n !== null && root.contains(n as Node);
	const mark = (t: EventTarget | null, on: boolean) => {
		const el = t as HTMLElement | null;
		if (el?.matches === undefined || el.matches(TYPED)) return;
		if (on) el.setAttribute(ATTR, '');
		else el.removeAttribute(ATTR);
	};
	const onPointer = (e: Event) => {
		pressed = true;
		// A press on what already has focus moves none, so no focusin follows: mark it here.
		const now = document.activeElement;
		if (now !== null && inside(now) && now.contains(e.target as Node)) mark(now, true);
	};
	const onKey = (e: KeyboardEvent) => {
		// Only Tab: a modifier, Escape or Enter leaves the source as it was.
		if (e.key === 'Tab') pressed = false;
	};
	const onFocusIn = (e: FocusEvent) => mark(e.target, pressed);
	// The mark always comes off: writing opened after the press is not marked, but what it was opened on may be.
	const onFocusOut = (e: FocusEvent) => (e.target as HTMLElement | null)?.removeAttribute?.(ATTR);
	const doc = document;
	root.addEventListener('pointerdown', onPointer, true);
	doc.addEventListener('keydown', onKey);
	root.addEventListener('focusin', onFocusIn);
	root.addEventListener('focusout', onFocusOut);
	return () => {
		root.removeEventListener('pointerdown', onPointer, true);
		doc.removeEventListener('keydown', onKey);
		root.removeEventListener('focusin', onFocusIn);
		root.removeEventListener('focusout', onFocusOut);
	};
}
