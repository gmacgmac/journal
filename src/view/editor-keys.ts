// The keys while writing, done the journal's way rather than the browser's:
//   Enter       a new paragraph, a new list item, or out of the list; all of it stays in this one session and saves
//               as one edit when you leave
//   Shift+Enter a line break inside the paragraph
//   Backspace   at the start: joins the paragraph to the one above, turns a to-do into a plain item and an item into
//               a paragraph, or removes an empty block
//   ⌘B ⌘I ⌘K   bold, italic, link; ⌘U does nothing (Markdown has no underline)
//   Esc, ⌘↵     done
// Typing "- ", "1. ", "[] " or "> " at the start of a paragraph makes a list, a numbered list, a to-do or a quote.
// Paste is always plain text.
import { caretIn, caretOffset, collapsed, cutAfterCaret, placeCaret, selection } from './caret.ts';
import { el } from './render.ts';
import type { BlockNode, Session } from './session.ts';

/** Formatting a journal can't hold, and structure only the keys above may make. */
const BLOCKED = new Set([
	'formatUnderline', 'formatJustifyLeft', 'formatJustifyCenter', 'formatJustifyRight', 'formatJustifyFull',
	'formatIndent', 'formatOutdent', 'formatSuperscript', 'formatSubscript', 'formatFontColor', 'formatBackColor',
	'formatFontName', 'insertOrderedList', 'insertUnorderedList', 'insertHorizontalRule', 'insertFromDrop',
	'insertFromPasteAsQuotation', 'insertLink',
]);

export const checkbox = (checked = false): HTMLInputElement => el('input', [], {
	type: 'checkbox', class: 'todo', contenteditable: 'false', 'aria-label': 'Done', ...(checked ? { checked: '' } : {}),
});

/** An empty item keeps a <br> so the caret has somewhere to stand; the reader drops it. */
function caretIntoItem(li: HTMLElement, at = 0): void {
	if (li.textContent === '') {
		if (li.querySelector(':scope > br') === null) li.append(el('br'));
		const r = document.createRange();
		r.setStartBefore(li.querySelector(':scope > br')!);
		r.collapse(true);
		selection().removeAllRanges();
		selection().addRange(r);
	} else placeCaret(li, at);
}

export function onKeyDown(e: KeyboardEvent, s: Session): void {
	if (e.isComposing) return;
	const mod = e.metaKey || e.ctrlKey;
	const key = e.key.toLowerCase();
	if (e.key === 'Escape' || (mod && e.key === 'Enter')) {
		e.preventDefault();
		void s.finish({ then: 'self' });
	} else if (mod && key === 'k') {
		e.preventDefault();
		s.act('link');
	} else if (mod && key === 'u') e.preventDefault();
	else if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		enter(s, e.target);
	} else if (e.key === 'Backspace') backspace(e, s);
}

export function onBeforeInput(e: InputEvent, s: Session): void {
	if (s.busy || BLOCKED.has(e.inputType)) e.preventDefault();
	else if (e.inputType === 'insertParagraph') {
		e.preventDefault();
		enter(s, e.target);
	} else if (e.inputType === 'insertFromPaste') {
		e.preventDefault();
		paste(s, e.target, e.dataTransfer?.getData('text/plain') ?? '');
	}
}

/** An empty paragraph or item keeps a <br> so it has a line to stand on; the reader drops it. */
function holdOpen(p: HTMLElement): void {
	if (p.textContent === '' && p.querySelector('[data-src], br') === null) p.append(el('br'));
}

function enter(s: Session, target: EventTarget | null): void {
	if (s.spec.enter?.(target)) return;
	if (target !== s.root) return void s.finish({ then: 'next' });
	const li = caretIn(s.root, ['LI']);
	if (li !== null) return enterItem(li);
	let p = caretIn(s.root, ['P']);
	if (p === null) {
		// The caret sits between elements (select-all, an arrow past the end): take it as the end of the last paragraph.
		p = [...s.root.querySelectorAll('p')].at(-1) ?? null;
		if (p === null) return;
		placeCaret(p, 'end');
	}
	const quote = caretIn(s.root, ['BLOCKQUOTE']);
	const second = el('p');
	second.append(cutAfterCaret(p));
	holdOpen(p);
	holdOpen(second);
	(quote ?? p).after(second);
	placeCaret(second, 0);
}

function enterItem(li: HTMLElement): void {
	const list = li.parentElement!;
	if ((li.textContent ?? '').trim() === '') {
		// Enter on an empty item leaves the list for a new paragraph under it.
		li.remove();
		const p = el('p', [el('br')]);
		list.after(p);
		if (list.children.length === 0) list.remove();
		return placeCaret(p, 0);
	}
	const next = el('li', [], li.classList.contains('task') ? { class: 'task' } : {});
	if (li.querySelector(':scope > input.todo') !== null) next.append(checkbox(false));
	next.append(cutAfterCaret(li));
	li.after(next);
	caretIntoItem(next);
}

function backspace(e: KeyboardEvent, s: Session): void {
	if (!collapsed()) return;
	const li = caretIn(s.root, ['LI']);
	if (li !== null) {
		if (caretOffset(li) !== 0) return;
		e.preventDefault();
		return backItem(li);
	}
	const p = caretIn(s.root, ['P']);
	if (p === null || caretOffset(p) !== 0) return;
	e.preventDefault();
	const above = p.previousElementSibling;
	if (above?.tagName === 'P') {
		const at = (above.textContent ?? '').length;
		above.append(...p.childNodes);
		p.remove();
		return placeCaret(above, at);
	}
	if ((s.root.textContent ?? '').trim() === '') return s.remove();
	const prev = s.node.previousElementSibling as BlockNode | null;
	if (s.kind === 'body' && prev?.dataset.kind === 'paragraph' && p === s.root.firstElementChild) s.spec.merge?.(s, prev);
}

function backItem(li: HTMLElement): void {
	const box = li.querySelector(':scope > input.todo');
	if (box !== null) {
		box.remove();
		li.classList.remove('task');
		return caretIntoItem(li);
	}
	const prev = li.previousElementSibling;
	if (prev !== null) {
		const at = (prev.textContent ?? '').length;
		prev.querySelector(':scope > br:last-child')?.remove();
		prev.append(...li.childNodes);
		li.remove();
		return placeCaret(prev, at);
	}
	const list = li.parentElement!;
	const p = el('p');
	p.append(...li.childNodes);
	list.before(p);
	li.remove();
	if (list.children.length === 0) list.remove();
	placeCaret(p, 0);
}

/** Pasted text as plain paragraphs: a blank line splits them, any other line break is a space. */
export function pasteChunks(raw: string): string[] {
	return raw.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/).map((c) => c.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

function paste(s: Session, target: EventTarget | null, raw: string): void {
	const chunks = pasteChunks(raw);
	if (chunks.length === 0) return;
	const p = target === s.root ? caretIn(s.root, ['P']) : null;
	if (p === null || caretIn(s.root, ['LI']) !== null) return void document.execCommand('insertText', false, chunks.join(' '));
	document.execCommand('insertText', false, chunks[0]);
	let at: HTMLElement = p;
	for (const words of chunks.slice(1)) {
		const next = el('p', [words]);
		at.after(next);
		at = next;
	}
	placeCaret(at, 'end');
}

/** Make `p` a list item, a to-do or a quote, keeping its words and the caret at their start. */
function convert(p: HTMLElement, { ordered = false, todo = false, quote = false }, caret = 0): void {
	if (quote) {
		const q = el('blockquote');
		p.replaceWith(q);
		q.append(p);
		return placeCaret(p, caret);
	}
	const li = el('li', todo ? [checkbox(false)] : [], todo ? { class: 'task' } : {});
	li.append(...p.childNodes);
	p.replaceWith(el(ordered ? 'ol' : 'ul', [li]));
	caretIntoItem(li, caret);
}

function dropLeading(p: HTMLElement, n: number): void {
	const r = document.createRange();
	r.setStart(p, 0);
	placeCaret(p, n);
	const end = selection().getRangeAt(0);
	r.setEnd(end.startContainer, end.startOffset);
	r.deleteContents();
}

/** The marker at the start of a paragraph that makes it structure: a to-do, a list, a numbered list or a quote. */
export const MARKER_RE = /^(?:(- \[ ?\] |\[ ?\] )|([-*+] )|(1[.)] )|(> ))/;

export function onInput(e: InputEvent, s: Session): void {
	if (e.inputType !== 'insertText' || !e.data?.includes(' ')) return;
	const p = caretIn(s.root, ['P']);
	if (p === null || caretIn(s.root, ['BLOCKQUOTE']) !== null) return;
	const at = caretOffset(p);
	const m = MARKER_RE.exec((p.textContent ?? '').replace(/ /g, ' '));
	// Only the insertion that finished the marker turns it into structure, never later typing.
	if (m === null || at - e.data.length >= m[0].length) return;
	dropLeading(p, m[0].length);
	convert(p, { todo: m[1] !== undefined, ordered: m[3] !== undefined, quote: m[4] !== undefined }, at - m[0].length);
}

/** The bar's To-do: tick-box on or off for the current item, or make the paragraph a to-do. */
export function toTodo(s: Session): void {
	const li = caretIn(s.root, ['LI']);
	if (li !== null) {
		const box = li.querySelector(':scope > input.todo');
		if (box !== null) box.remove();
		else li.prepend(checkbox(false));
		li.classList.toggle('task', box === null);
		return caretIntoItem(li, 0);
	}
	const p = caretIn(s.root, ['P']);
	if (p !== null) convert(p, { todo: true }, caretOffset(p));
}
