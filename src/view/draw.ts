// The Journal's own markup, drawn inside the root its host gives it: the toolbar (`toolbar.ts`), the paper and its one
// sheet, the writing bar and the toast. Nothing outside the root is touched, and nothing here is shared between mounts: even the writing
// hint's id is this mount's own, so two journals in one page never point at each other's.
import { el } from './render.ts';
import { say } from './words.ts';

function bar(): HTMLElement {
	const act = (name: string, label: Node | string, attrs: Record<string, string> = {}) =>
		el('button', [label], { type: 'button', 'data-act': name, ...attrs });
	return el('div', [
		el('div', [
			act('bold', el('b', ['B']), { 'aria-label': say('journal.view.bar.bold'), title: say('journal.view.bar.boldHint') }),
			act('italic', el('i', ['I']), { 'aria-label': say('journal.view.bar.italic'), title: say('journal.view.bar.italicHint') }),
			act('link', say('journal.view.bar.link'), { title: say('journal.view.bar.linkHint') }),
			act('todo', say('journal.view.bar.todo'), { title: say('journal.view.bar.todoHint') }),
			act('title', say('journal.view.bar.title'), { hidden: '' }),
			el('span', [], { class: 'gap' }),
			act('ask', say('journal.view.bar.ask')),
			act('remove', say('journal.view.bar.remove')),
			act('done', say('journal.view.bar.done'), { class: 'primary', title: say('journal.view.bar.doneHint') }),
		], { class: 'bar-tools' }),
		el('form', [
			el('label', [say('journal.view.bar.linkTo'), ' ', el('input', [], { type: 'url', required: '' })]),
			el('button', [say('journal.view.bar.addLink')], { type: 'submit', class: 'primary' }),
			el('button', [say('journal.view.bar.cancel')], { type: 'button', 'data-act': 'link-cancel' }),
		], { class: 'bar-link', hidden: '' }),
		el('div', [], { class: 'bar-notice', role: 'status' }),
	], { class: 'bar', role: 'toolbar', 'aria-label': say('journal.view.bar.label'), hidden: '' });
}

export interface Drawn {
	paper: HTMLElement;
	/** The sheet of paper the days are drawn on. */
	sheet: HTMLElement;
	bar: HTMLElement;
	toast: HTMLElement;
	/** The id of the "Press Enter to write here." line, unique to this mount. */
	hintId: string;
}

/** A fresh id for this mount's hint, so ids never collide across mounts. No counter: nothing kept in the module. */
const freshId = () => `journal-hint-${Math.random().toString(36).slice(2, 10)}`;

/** Draw the view into `root` and hand back the parts the mount wires up. */
export function drawView(root: HTMLElement, toolbar: HTMLElement): Drawn {
	const hintId = freshId();
	const sheet = el('div', [], { class: 'sheet' });
	const paper = el('div', [sheet], { class: 'paper' });
	const hint = el('p', [say('journal.view.hint')], { id: hintId, class: 'edit-hint', hidden: '' });
	const undo = el('button', [say('journal.view.undo.button')], { type: 'button' });
	const toast = el('div', [el('span'), undo], { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: '' });
	const writing = bar();
	root.classList.add('journal');
	root.replaceChildren(el('div', [toolbar], { class: 'journal-tools' }), paper, hint, writing, toast);
	return { paper, sheet, bar: writing, toast, hintId };
}
