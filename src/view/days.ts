// Days as elements, kept live. Each block is one element carrying its file and range (`data-date`, `data-start`,
// `data-end`) and its key. When a day file changes on disk, only blocks whose key changed are added or removed; every
// other element stays where it is, so the page never jumps. Writing in progress is never thrown away: an open editor
// whose block changed stays (marked stale), and a draft stays where it was put.
// A day whose file breaks the rules (spec § The data) is drawn as it is, read only, with its problems over it: no block
// opens, no box ticks, and no entry is added, since the engine refuses every write to it.
import { entryOf, localToday } from '../format/index.ts';
import type { Block, Day } from './wire.ts';
import { icon } from './icons.ts';
import { el, parseMarkdown, renderMarkdown } from './render.ts';
import { isEditing, type BlockNode } from './session.ts';
import { say } from './words.ts';

/** Whether a day's file breaks the rules, so the page shows it read only. */
export const isBroken = (day: Day): boolean => (day.problems ?? []).length > 0;

/** A day's blocks under its date line (the date line is drawn as the page heading; a broken day may not start with one). */
export const writingOf = (day: Day) => (day.blocks[0]?.text === `# ${day.title}` ? day.blocks.slice(1) : day.blocks);

/**
 * Whether a day has a page to show: a file with writing in it, or one that breaks the rules. A file left with only its
 * date line (its last entry deleted, or the day removed) is shown as a day with no page, with the way to start it (GM,
 * 2026-11-19: not "Nothing written").
 */
export const hasPage = (day: Day): boolean => day.exists && (isBroken(day) || writingOf(day).length > 0);

export function setRange(node: BlockNode, date: string, b: Block): void {
	node.dataset.date = date;
	node.dataset.start = String(b.start);
	node.dataset.end = String(b.end);
	node.dataset.key = b.key;
	node._text = b.text;
}

/** One block, pointing at its mount's writing hint (`hintId`). */
export function blockElement(date: string, b: Block, hintId: string): BlockNode {
	const node: BlockNode = el('div', [], { class: 'block', tabindex: '0', 'aria-describedby': hintId });
	setRange(node, date, b);
	const entry = entryOf(b.text);
	if (entry !== null) {
		node.classList.add('entry-head');
		// An entry with no time keeps the time's place, empty and hidden, so its title sits where every title sits.
		const time = el('span', entry.time === null ? [] : [entry.time], { class: 'time' });
		if (entry.time === null) {
			time.hidden = true;
			node.classList.add('no-time');
		}
		node.append(time);
		// The handle to drag the entry to another place (drag.ts), in the margin; never part of the heading's text. Only an
		// entry with no time has one: a timed entry's place is its time (GM, 2026-11-19).
		if (entry.time === null) {
			node.append(el('button', [icon('grip')], {
				type: 'button', class: 'drag-handle', contenteditable: 'false', 'aria-label': say('journal.view.move.handle', { entry: entry.title ?? '' }),
			}));
		}
		if (entry.title !== null) {
			node.classList.add('has-title');
			node.append(el('span', [...renderMarkdown(entry.title)[0]!.childNodes], { class: 'title' }));
		}
	} else {
		node.dataset.kind = parseMarkdown(b.text)[0]?.kind ?? 'paragraph';
		node.append(...renderMarkdown(b.text));
	}
	return node;
}

export function daySection(day: Day, hintId: string, today = localToday()): HTMLElement {
	const head = el('header', [el('h2', [day.title])]);
	const section = el('section', [head], { class: 'day', 'data-date': day.date });
	if (day.date === today) {
		section.classList.add('today');
		head.prepend(el('span', [say('journal.view.today')], { class: 'today-mark' }));
	}
	const start = day.date === today ? 'journal.view.day.startToday' : 'journal.view.day.start';
	const add = el('button', [say(start)], { type: 'button', class: 'add-entry', 'data-timed': 'false' });
	if (isBroken(day)) {
		section.classList.add('broken');
		const problems = el('ul', day.problems.map((p) => el('li', [p])));
		section.append(el('div', [el('p', [say('journal.view.day.broken')]), problems], { class: 'problems', role: 'note' }));
		section.append(el('div', [], { class: 'entries' }));
		patchDay(day, section, false, hintId);
		return section;
	}
	if (!hasPage(day)) {
		// A day with no page is one line: its date, and the way to start it.
		section.classList.add('gap');
		head.append(add);
		return section;
	}
	// Remove this day: at the end of the date line, shown only while that line is pointed at; it moves nothing (GM, 2026-11-19).
	head.append(el('button', [icon('trash'), el('span', [say('journal.view.day.remove')])], {
		type: 'button', class: 'day-remove', 'aria-label': say('journal.view.day.removeLabel', { date: day.title }),
	}));
	section.append(el('div', [], { class: 'entries' }), addZone());
	// A first drawing is not a change, so nothing is marked fresh.
	patchDay(day, section, false, hintId);
	return section;
}

/**
 * The foot of a day, the room under its last entry: a faint + while the day is pointed at, its two ways to add an entry
 * once the pointer is in this room, each full only when pointed at itself (GM, 2026-11-19). Nothing in it moves.
 */
function addZone(): HTMLElement {
	const entry = el('button', [icon('plus'), el('span', [say('journal.view.add.entry')], { class: 'add-label' })], {
		type: 'button', class: 'add-entry', 'data-timed': 'false', 'aria-label': say('journal.view.day.add'),
	});
	const timed = el('button', [icon('plus'), el('span', [say('journal.view.add.timed')], { class: 'add-label' })], {
		type: 'button', class: 'add-entry', 'data-timed': 'true', 'aria-label': say('journal.view.day.addTimed'),
	});
	return el('div', [entry, timed], { class: 'add-zone' });
}

/** A broken day's blocks: nothing to tab to or tick, and no hint to write. */
function readOnly(section: Element): void {
	for (const node of section.querySelectorAll('.block')) {
		node.removeAttribute('tabindex');
		node.removeAttribute('aria-describedby');
	}
	for (const box of section.querySelectorAll<HTMLInputElement>('input.todo')) box.disabled = true;
	for (const handle of section.querySelectorAll('.drag-handle')) handle.remove();
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
	// A page that appeared or went, or started or stopped breaking the rules, is drawn anew.
	if (section.classList.contains('gap') === hasPage(day) || section.classList.contains('broken') !== isBroken(day)) {
		section.replaceWith(daySection(day, hintId));
		return { date: day.date, replacedDay: true };
	}
	// Still no page: a gap has nothing to patch.
	if (!hasPage(day)) return { date: day.date, kept: 0, added: 0, removed: 0, moved: 0 };
	const body = section.querySelector('.entries')!;
	const blocks = writingOf(day);
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
	// Writing a new entry hides Add an entry; once that entry is saved or gone, it is back. Read from the page, since a
	// save patches the day without the draft knowing (GM, 2026-11-19).
	section.classList.toggle('drafting', section.querySelector('.entry-draft') !== null);
	if (isBroken(day)) readOnly(section);
	return stats;
}
