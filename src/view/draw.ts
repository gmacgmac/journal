// The Journal's own markup, drawn inside the root its host gives it: the range controls, the paper, the writing bar
// and the toast. Nothing outside the root is touched, and nothing here is shared between mounts: even the writing
// hint's id is this mount's own, so two journals in one page never point at each other's.
import { el } from './render.ts';

const button = (act: string, label: string, attrs: Record<string, string> = {}) =>
	el('button', [label], { type: 'button', 'data-range': act, ...attrs });

function tools(): HTMLElement {
	return el('nav', [
		button('prev', '‹', { 'aria-label': 'Earlier days' }),
		button('this-week', 'This week'),
		button('last-7', 'Last 7 days'),
		button('sample', 'Sample week'),
		button('next', '›', { 'aria-label': 'Later days' }),
		el('label', ['From ', el('input', [], { type: 'date', 'data-range': 'from' })]),
		el('label', ['To ', el('input', [], { type: 'date', 'data-range': 'to' })]),
	], { class: 'range', 'aria-label': 'Days shown' });
}

function bar(): HTMLElement {
	const act = (name: string, label: Node | string, attrs: Record<string, string> = {}) =>
		el('button', [label], { type: 'button', 'data-act': name, ...attrs });
	return el('div', [
		el('div', [
			act('bold', el('b', ['B']), { 'aria-label': 'Bold', title: 'Bold  ⌘B' }),
			act('italic', el('i', ['I']), { 'aria-label': 'Italic', title: 'Italic  ⌘I' }),
			act('link', 'Link', { title: 'Link  ⌘K' }),
			act('todo', 'To-do', { title: 'To-do  (or type [] and a space)' }),
			act('title', 'Add title', { hidden: '' }),
			el('span', [], { class: 'gap' }),
			act('ask', 'Add to chat'),
			act('remove', 'Delete'),
			act('done', 'Done', { class: 'primary', title: 'Done  Esc' }),
		], { class: 'bar-tools' }),
		el('form', [
			el('label', ['Link to ', el('input', [], { type: 'url', required: '' })]),
			el('button', ['Add link'], { type: 'submit', class: 'primary' }),
			el('button', ['Cancel'], { type: 'button', 'data-act': 'link-cancel' }),
		], { class: 'bar-link', hidden: '' }),
		el('div', [], { class: 'bar-notice', role: 'status' }),
	], { class: 'bar', role: 'toolbar', 'aria-label': 'Writing', hidden: '' });
}

export interface Drawn {
	paper: HTMLElement;
	spread: HTMLElement;
	bar: HTMLElement;
	toast: HTMLElement;
	/** The id of the "Press Enter to write here." line, unique to this mount. */
	hintId: string;
}

/** A fresh id for this mount's hint, so ids never collide across mounts. No counter: nothing kept in the module. */
const freshId = () => `journal-hint-${Math.random().toString(36).slice(2, 10)}`;

/** Draw the view into `root` and hand back the parts the mount wires up. */
export function drawView(root: HTMLElement): Drawn {
	const hintId = freshId();
	const spread = el('div', [], { class: 'spread' });
	const paper = el('div', [spread], { class: 'paper', 'data-paper': 'follow' });
	const hint = el('p', ['Press Enter to write here.'], { id: hintId, class: 'edit-hint', hidden: '' });
	const toast = el('div', [el('span'), el('button', ['Undo'], { type: 'button' })], { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: '' });
	const writing = bar();
	root.classList.add('journal');
	root.replaceChildren(el('div', [tools()], { class: 'journal-tools' }), paper, hint, writing, toast);
	return { paper, spread, bar: writing, toast, hintId };
}
