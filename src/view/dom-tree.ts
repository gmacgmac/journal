// WHAT IS ON SCREEN, READ BACK AS THE PARSER'S TREE. The editor lets the person format text the browser's way (⌘B
// makes a <b>); this turns those elements back into the same tree `parseMarkdown` produces, so the serializer can
// write it as Markdown and a check can prove it round-trips.
//
// `render.ts` leaves what it can't show on the elements (`data-href` on every link, an image's `data-src`/`data-alt`),
// so reading a block nobody touched gives exactly the tree it was drawn from.
import { linkify, type Block, type Inline, type ListItem } from '../vendor/markdown/index.ts';

type Mark = 'strong' | 'em' | 'strike';
const MARKS: Record<string, Mark> = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', S: 'strike', STRIKE: 'strike', DEL: 'strike' };
const BLOCKS = new Set(['P', 'UL', 'OL', 'BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3']);

/** A raw inline before tidying: a link may still be missing its href (`null`), a mark may be empty. */
type Raw = Inline | { kind: 'link'; href: string; children: Raw[] } | { kind: Mark; children: Raw[] };

const isElement = (n: Node): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE;

function rawInlines(node: Node): Raw[] {
	const out: Raw[] = [];
	for (const child of node.childNodes) {
		if (child.nodeType === Node.TEXT_NODE) {
			out.push({ kind: 'text', text: (child as Text).data.replace(/ /g, ' ') });
			continue;
		}
		if (!isElement(child) || child.tagName === 'INPUT') continue;
		const tag = child.tagName;
		const mark = MARKS[tag];
		if (mark !== undefined) out.push({ kind: mark, children: rawInlines(child) });
		else if (tag === 'CODE') out.push({ kind: 'code', text: child.textContent ?? '' });
		else if (tag === 'BR') out.push({ kind: 'break' });
		else if (child.dataset.src !== undefined) out.push({ kind: 'image', src: child.dataset.src, alt: child.dataset.alt ?? '' });
		else if (tag === 'A' || child.dataset.href !== undefined) {
			out.push({ kind: 'link', href: child.dataset.href ?? child.getAttribute('href') ?? '', children: rawInlines(child) });
		} else out.push(...rawInlines(child));
	}
	return out;
}

const text = (t: string): Inline => ({ kind: 'text', text: t });
const hasChildren = (n: Raw): n is Extract<Raw, { children: Raw[] }> => 'children' in n;

/**
 * Tidy what a browser leaves into what the parser would give: runs merged, no empty marks, spaces moved outside
 * marks, no trailing <br>, and typed web addresses made links (never inside a link, as the parser does).
 */
function tidy(nodes: Raw[], top = true, inLink = false): Inline[] {
	const out: Inline[] = [];
	for (const n of nodes) {
		if (!hasChildren(n)) {
			if (n.kind !== 'text' || n.text !== '') push(out, n);
			continue;
		}
		const children = tidy(n.children, false, inLink || n.kind === 'link');
		if (children.length === 0) continue;
		if (n.kind === 'link') {
			push(out, { kind: 'link', href: n.href, children });
			continue;
		}
		let lead = '';
		let trail = '';
		const first = children[0]!;
		if (first.kind === 'text') {
			lead = /^\s*/.exec(first.text)![0];
			children[0] = text(first.text.slice(lead.length));
		}
		const last = children.at(-1)!;
		if (last.kind === 'text') {
			trail = /\s*$/.exec(last.text)![0];
			children[children.length - 1] = text(last.text.slice(0, last.text.length - trail.length));
		}
		const kept = children.filter((c) => c.kind !== 'text' || c.text !== '');
		if (lead !== '') push(out, text(lead));
		if (kept.length > 0) push(out, { kind: n.kind, children: kept });
		if (trail !== '') push(out, text(trail));
	}
	while (top && out.at(-1)?.kind === 'break') out.pop();
	return inLink ? out : out.flatMap((n) => (n.kind === 'text' ? linkify(n.text) : [n]));
}

function push(out: Inline[], n: Inline): void {
	const prev = out.at(-1);
	if (prev?.kind === 'text' && n.kind === 'text') out[out.length - 1] = text(prev.text + n.text);
	else if (prev !== undefined && prev.kind === n.kind && 'children' in n && 'children' in prev && n.kind !== 'link') {
		out[out.length - 1] = { kind: n.kind, children: [...prev.children, ...n.children] } as Inline;
	} else out.push(n);
}

export function readInlines(node: Node): Inline[] {
	return tidy(rawInlines(node));
}

const wrap = (e: Element): HTMLElement => {
	const box = document.createElement('div');
	box.append(e.cloneNode(true));
	return box;
};

function readItem(li: Element): ListItem {
	const box = li.querySelector<HTMLInputElement>(':scope > input[type=checkbox]');
	const children: Block[] = [];
	let run = document.createElement('span');
	const flush = () => {
		const inl = readInlines(run);
		if (inl.length > 0) children.push({ kind: 'paragraph', children: inl });
		run = document.createElement('span');
	};
	for (const child of [...li.childNodes]) {
		if (isElement(child) && BLOCKS.has(child.tagName)) {
			flush();
			children.push(...readBlocks(child.tagName === 'DIV' ? child : wrap(child)));
		} else if (!(isElement(child) && child.tagName === 'INPUT')) run.append(child.cloneNode(true));
	}
	flush();
	return { checked: box === null ? null : box.checked, children };
}

/** The blocks held by `root`, in order. Loose inline content counts as a paragraph. */
export function readBlocks(root: Node): Block[] {
	const blocks: Block[] = [];
	let loose = document.createElement('span');
	const flush = () => {
		const inl = readInlines(loose);
		if (inl.length > 0) blocks.push({ kind: 'paragraph', children: inl });
		loose = document.createElement('span');
	};
	for (const child of [...root.childNodes]) {
		const tag = isElement(child) ? child.tagName : null;
		if (tag === 'P' || tag === 'DIV') {
			flush();
			const inl = readInlines(child);
			if (inl.length > 0) blocks.push({ kind: 'paragraph', children: inl });
		} else if (tag === 'UL' || tag === 'OL') {
			flush();
			const items = [...(child as Element).children].filter((li) => li.tagName === 'LI').map(readItem);
			const start = tag === 'OL' ? (child as HTMLOListElement).start || 1 : 1;
			if (items.length > 0) blocks.push({ kind: 'list', ordered: tag === 'OL', start, items });
		} else if (tag === 'BLOCKQUOTE') {
			flush();
			const inner = readBlocks(child);
			if (inner.length > 0) blocks.push({ kind: 'blockquote', children: inner });
		} else loose.append(child.cloneNode(true));
	}
	flush();
	return blocks;
}

/** Structural equality, ignoring key order. */
export function same(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	const rb = b as Record<string, unknown>;
	return ka.length === Object.keys(b).length && ka.every((k) => same((a as Record<string, unknown>)[k], rb[k]));
}
