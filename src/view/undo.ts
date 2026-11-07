// Undo: every saved edit comes back from the engine with the edit that undoes it. They stack, newest last. The toast
// offers the newest; ⌘Z outside the writing takes it too (inside the writing, ⌘Z is the browser's own typing undo).
// An undo is an edit like any other, so it is refused if the page has changed. One stack and one toast per mount.
import type { Day, EditResult, RangeEdit } from './wire.ts';
import { say } from './words.ts';

/** What undo needs from its page. */
export interface UndoPage {
	edit(e: RangeEdit): Promise<EditResult>;
	patch(day: Day, fresh?: boolean): void;
	focusAt(date: string, start: number): void;
	/** Says a refused undo, through the host. */
	notify(text: string, tone?: 'info' | 'error'): void;
}

export interface Undo {
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
		if (undo === undefined) return show(say('journal.view.undo.nothing'), false);
		const r = await page.edit(undo);
		if (r.day) page.patch(r.day);
		if (!r.ok) return page.notify(r.status === 409 ? say('journal.view.undo.changed') : r.reason, 'error');
		show(say('journal.view.undo.done'), false);
		page.focusAt(undo.date, undo.start);
	}

	function onKey(e: KeyboardEvent): void {
		const t = e.target as HTMLElement;
		const writing = t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName);
		if (e.defaultPrevented || writing || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
		e.preventDefault();
		void undoLast();
	}

	const onClick = () => void undoLast();
	button.addEventListener('click', onClick);
	scope.addEventListener('keydown', onKey);
	return {
		push(undo, label = say('journal.view.saved')) {
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
