// Days as elements, kept live. Each block is one element carrying its file and range (`data-date`, `data-start`,
// `data-end`) and its key. When a day file changes on disk, only blocks whose key changed are added or removed; every
// other element stays where it is, so the page never jumps. Writing in progress is never thrown away: an open editor
// whose block changed stays (marked stale), and a draft stays where it was put.
import type { Day, DayBlock } from './app.ts';
import { ENTRY_RE } from './dates.ts';
import { el, parseMarkdown, renderMarkdown } from './render.ts';
import { isEditing, type BlockNode } from './session.ts';

export function setRange(node: BlockNode, date: string, b: DayBlock): void {
	node.dataset.date = date;
	node.dataset.start = String(b.start);
	node.dataset.end = String(b.end);
	node.dataset.key = b.key;
	node._text = b.text;
}

/** One block, pointing at its mount's writing hint (`hintId`). */
export function blockElement(date: string, b: DayBlock, hintId: string): BlockNode {
	const node: BlockNode = el('div', [], { class: 'block', tabindex: '0', 'aria-describedby': hintId });
	setRange(node, date, b);
	const entry = ENTRY_RE.exec(b.text);
	if (entry !== null) {
		node.classList.add('entry-head');
		node.append(el('span', [`${entry[1]}:${entry[2]}`], { class: 'time' }));
		if (entry[3] !== undefined) {
			node.classList.add('has-title');
			node.append(el('span', [...renderMarkdown(entry[3])[0]!.childNodes], { class: 'title' }));
		}
	} else {
		node.dataset.kind = parseMarkdown(b.text)[0]?.kind ?? 'paragraph';
		node.append(...renderMarkdown(b.text));
	}
	return node;
}

export function daySection(day: Day, hintId: string): HTMLElement {
	const head = el('header', [el('h2', [day.title])]);
	const section = el('section', [head], { class: 'day', 'data-date': day.date });
	const add = el('button', [day.exists ? 'Add an entry' : 'Start this page'], { type: 'button', class: 'add-entry' });
	if (!day.exists) {
		section.classList.add('gap');
		section.append(el('p', ['No page for this day.'], { class: 'quiet' }), add);
		return section;
	}
	section.append(el('div', [], { class: 'entries' }), el('p', ['Nothing written.'], { class: 'quiet empty' }), add);
	// A first drawing is not a change, so nothing is marked fresh.
	patchDay(day, section, false, hintId);
	return section;
}

/** Kept through a patch and skipped over when placing: a draft, or an editor whose block changed. */
const pinned = (node: Element) => node.classList.contains('draft') || node.classList.contains('stale');

/** What a patch did; the tests read it. */
export type PatchStats =
	| { date: string; replacedDay: true }
	| { date: string; kept: number; added: number; removed: number; moved: number };

/**
 * Bring one day's elements in line with `day`, touching only what changed.
 * `fresh` marks new blocks for a moment: for the bot's changes, not the person's own.
 */
export function patchDay(day: Day, section: Element | null, fresh: boolean, hintId: string): PatchStats | null {
	if (section === null) return null;
	if (section.classList.contains('gap') === day.exists) {
		section.replaceWith(daySection(day, hintId));
		return { date: day.date, replacedDay: true };
	}
	const body = section.querySelector('.entries')!;
	const blocks = day.blocks.slice(1); // the first is the date, drawn as the page heading
	const wanted = new Set(blocks.map((b) => b.key));
	const old = new Map<string, BlockNode>();
	const stats = { date: day.date, kept: 0, added: 0, removed: 0, moved: 0 };
	// Gone blocks leave first, so nothing that stays is ever moved round them (a move blurs a focused editor).
	for (const node of [...body.children] as BlockNode[]) {
		if (node.classList.contains('draft')) continue;
		if (wanted.has(node.dataset.key!)) old.set(node.dataset.key!, node);
		else if (isEditing(node)) node._editor!.stale(day);
		else {
			node.remove();
			stats.removed += 1;
		}
	}
	let prev: Element | null = null;
	for (const b of blocks) {
		let node = old.get(b.key);
		if (node === undefined) {
			node = blockElement(day.date, b, hintId);
			if (fresh) node.classList.add('fresh');
			stats.added += 1;
		} else {
			old.delete(b.key);
			setRange(node, day.date, b);
			stats.kept += 1;
		}
		let next: Element | null = prev === null ? body.firstElementChild : prev.nextElementSibling;
		while (next !== null && next !== node && pinned(next)) next = next.nextElementSibling;
		if (next !== node) {
			if (node.isConnected) stats.moved += 1;
			body.insertBefore(node, next);
		}
		prev = node;
	}
	section.classList.toggle('blank', blocks.length === 0);
	return stats;
}
