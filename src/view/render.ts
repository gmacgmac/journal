// The parser's tree, rendered as ELEMENTS: the same policies as nclite's `Markdown.svelte`, in plain DOM calls:
//   - no raw HTML anywhere: every piece of text is a text node;
//   - every href goes through `safeHref`; a rejected one renders as its text;
//   - an image renders as a link, never an <img> (no fetch without a click);
//   - what an element can't show is kept on it (`data-href`, `data-src`, `data-alt`) so `dom-tree.ts` reads back
//     exactly the tree it was drawn from;
//   - a list item that is one paragraph renders tight, with no <p>.
import { parseMarkdown, safeHref, type Block, type Inline, type ListItem } from '../vendor/markdown/index.ts';

/** An element with attributes and children, the one way the view makes markup. */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K, children: (Node | string)[] = [], attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	node.append(...children);
	return node;
}

/** Every link carries its address as written (`data-href`), so the editor can read it back. */
function anchor(href: string, label: Inline[]): HTMLElement[] {
	const safe = safeHref(href);
	if (safe === null) return [el('span', inlines(label), { 'data-href': href })];
	return [el('a', inlines(label), { href: safe, target: '_blank', rel: 'noopener noreferrer', 'data-href': href })];
}

/** An image is a link to it, never an <img>; it is one piece the editor can't type into. */
function image(src: string, alt: string): HTMLElement[] {
	const words = [alt === '' ? src : alt];
	const safe = safeHref(src);
	const attrs = { 'data-src': src, 'data-alt': alt, contenteditable: 'false' };
	return [safe === null ? el('span', words, attrs) : el('a', words, { ...attrs, href: safe, target: '_blank', rel: 'noopener noreferrer' })];
}

export function inlines(nodes: Inline[]): Node[] {
	return nodes.flatMap((n): Node[] => {
		switch (n.kind) {
			case 'text': return [document.createTextNode(n.text)];
			case 'code': return [el('code', [n.text])];
			case 'strong': return [el('strong', inlines(n.children))];
			case 'em': return [el('em', inlines(n.children))];
			case 'strike': return [el('s', inlines(n.children))];
			case 'break': return [el('br')];
			case 'link': return anchor(n.href, n.children);
			default: return image(n.src, n.alt);
		}
	});
}

function item(it: ListItem): HTMLElement {
	const [only] = it.children;
	// A to-do's box is live: ticking it saves. It is never part of the text being typed.
	const attrs: Record<string, string> = { type: 'checkbox', class: 'todo', contenteditable: 'false', 'aria-label': 'Done' };
	const box = it.checked === null ? [] : [el('input', [], it.checked ? { ...attrs, checked: '' } : attrs)];
	const body = it.children.length === 1 && only?.kind === 'paragraph' ? inlines(only.children) : blocks(it.children);
	return el('li', [...box, ...body], it.checked === null ? {} : { class: 'task' });
}

function cell(tag: 'th' | 'td', nodes: Inline[], align: string | null | undefined): HTMLElement {
	const c = el(tag, inlines(nodes));
	if (align != null) c.style.textAlign = align;
	return c;
}

function block(b: Block): HTMLElement {
	switch (b.kind) {
		case 'paragraph': return el('p', inlines(b.children));
		case 'heading': return el(`h${b.level}`, inlines(b.children));
		case 'code': return el('pre', [el('code', [b.text])]);
		case 'blockquote': return el('blockquote', blocks(b.children));
		case 'list': return b.ordered
			? el('ol', b.items.map(item), b.start === 1 ? {} : { start: String(b.start) })
			: el('ul', b.items.map(item));
		case 'table': return el('table', [
			el('thead', [el('tr', b.header.map((h, i) => cell('th', h, b.align[i])))]),
			el('tbody', b.rows.map((r) => el('tr', r.map((c, i) => cell('td', c, b.align[i]))))),
		]);
		default: return el('hr');
	}
}

function blocks(list: Block[]): HTMLElement[] {
	return list.map(block);
}

/** The elements for one block's Markdown text. */
export function renderMarkdown(text: string): HTMLElement[] {
	return blocks(parseMarkdown(text));
}

/** The parsed tree, for callers that need a block's kind or a heading's words. */
export { parseMarkdown };
