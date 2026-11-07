// The caret, in terms the editor needs: is it at the start or end of a piece of writing, where is it as a count of
// characters, and put it back there. The selection is the document's, so these read it fresh every time.

export const selection = (): Selection => window.getSelection()!;

function rangeIn(el: Node): Range | null {
	const sel = selection();
	if (sel.rangeCount === 0) return null;
	const r = sel.getRangeAt(0);
	return el.contains(r.startContainer) ? r : null;
}

/** Characters of `el` before the caret, or -1 when the caret is not in it. */
export function caretOffset(el: Node): number {
	const r = rangeIn(el);
	if (r === null) return -1;
	const before = document.createRange();
	before.selectNodeContents(el);
	before.setEnd(r.startContainer, r.startOffset);
	return before.toString().length;
}

export const collapsed = (): boolean => selection().rangeCount > 0 && selection().getRangeAt(0).collapsed;
export const atStart = (el: Node): boolean => collapsed() && caretOffset(el) === 0;
export const atEnd = (el: Node): boolean => collapsed() && caretOffset(el) === (el.textContent ?? '').length;

/** Put the caret `n` characters into `el` (clamped); `'end'` for the end. */
export function placeCaret(el: Node, n: number | 'end' = 'end'): void {
	const length = (el.textContent ?? '').length;
	const target = n === 'end' ? length : Math.max(0, Math.min(n, length));
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	let left = target;
	let node = walker.nextNode() as Text | null;
	const r = document.createRange();
	while (node !== null) {
		if (left <= node.data.length) {
			r.setStart(node, left);
			break;
		}
		left -= node.data.length;
		node = walker.nextNode() as Text | null;
	}
	if (node === null) {
		r.selectNodeContents(el);
		r.collapse(target === 0);
	} else r.collapse(true);
	const sel = selection();
	sel.removeAllRanges();
	sel.addRange(r);
}

/** Cut everything after the caret out of `el` and return it as a fragment. */
export function cutAfterCaret(el: Node): DocumentFragment {
	const r = rangeIn(el);
	if (r === null) return document.createDocumentFragment();
	r.deleteContents();
	const tail = document.createRange();
	tail.setStart(r.startContainer, r.startOffset);
	tail.setEnd(el, el.childNodes.length);
	return tail.extractContents();
}

/** The nearest element of `tags` round the caret, inside `root`. */
export function caretIn(root: Node, tags: string[]): HTMLElement | null {
	const r = rangeIn(root);
	let n: Node | null = r?.startContainer ?? null;
	while (n !== null && n !== root) {
		if (n.nodeType === Node.ELEMENT_NODE && tags.includes((n as Element).tagName)) return n as HTMLElement;
		n = n.parentNode;
	}
	return null;
}

/** Keep and give back a selection, across a click in the bar that would lose it. */
export function keepSelection(): () => void {
	const sel = selection();
	const saved = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
	return () => {
		if (saved === null) return;
		sel.removeAllRanges();
		sel.addRange(saved);
	};
}

/** Put the caret where the person clicked, if that point is inside `within`. */
export function placeCaretAtPoint(x: number, y: number, within: Node): boolean {
	const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
	let r = doc.caretRangeFromPoint?.(x, y) ?? null;
	if (r === null && typeof document.caretPositionFromPoint === 'function') {
		const p = document.caretPositionFromPoint(x, y);
		if (p !== null) {
			r = document.createRange();
			r.setStart(p.offsetNode, p.offset);
		}
	}
	if (r === null || !within.contains(r.startContainer)) return false;
	r.collapse(true);
	selection().removeAllRanges();
	selection().addRange(r);
	return true;
}
