// Undo: every saved edit comes back from the engine with the edit that undoes it. They stack, newest last. The toast
// offers the newest; ⌘Z outside the writing takes it too (inside the writing, ⌘Z is the browser's own typing undo).
// An undo is an edit like any other, so it is refused if the page has changed. One stack and one toast per mount.
import type { Day, EditResult, RangeEdit } from './app.ts';

/** What undo needs from its page. */
export interface UndoPage {
	edit(e: RangeEdit): Promise<EditResult>;
	patch(day: Day, fresh?: boolean): void;
	focusAt(date: string, start: number): void;
}

export interface Undo {
	/** A line in the toast with nothing to undo. */
	notify(text: string): void;
	push(undo: RangeEdit, label?: string): void;
	undoLast(): Promise<void>;
	/** How many edits can be undone. */
	readonly depth: number;
	/** Unwire the keys and stop the toast's timer. */
	dispose(): void;
}

/** How long the toast stays, with and without an Undo to offer. */
export const TOAST_MS = { undo: 8000, plain: 4000 };

/** Wire the toast the view drew; ⌘Z is taken only while focus is inside `scope`. */
export function createUndo(page: UndoPage, toast: HTMLElement, scope: HTMLElement): Undo {
	const stack: RangeEdit[] = [];
	const words = toast.querySelector('span')!;
	const button = toast.querySelector('button')!;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function show(text: string, offerUndo: boolean): void {
		words.textContent = text;
		button.hidden = !offerUndo;
		toast.hidden = false;
		clearTimeout(timer);
		timer = setTimeout(() => (toast.hidden = true), offerUndo ? TOAST_MS.undo : TOAST_MS.plain);
	}

	async function undoLast(): Promise<void> {
		const undo = stack.pop();
		if (undo === undefined) return show('Nothing to undo.', false);
		const r = await page.edit(undo);
		if (r.day) page.patch(r.day);
		show(r.ok ? 'Undone.' : 'Can’t undo: that part has changed since.', false);
		if (r.ok) page.focusAt(undo.date, undo.start);
	}

	function onKey(e: KeyboardEvent): void {
		const t = e.target as HTMLElement;
		const writing = t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName);
		if (writing || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
		e.preventDefault();
		void undoLast();
	}

	const onClick = () => void undoLast();
	button.addEventListener('click', onClick);
	scope.addEventListener('keydown', onKey);
	return {
		notify: (text) => show(text, false),
		push(undo, label = 'Saved.') {
			stack.push(undo);
			show(label, true);
		},
		undoLast,
		get depth() {
			return stack.length;
		},
		dispose() {
			clearTimeout(timer);
			button.removeEventListener('click', onClick);
			scope.removeEventListener('keydown', onKey);
		},
	};
}
