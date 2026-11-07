// The Journal's view: a range of days as facing pages, kept live, written in place. `mountJournal(root, host)` draws
// only inside `root` and talks to the world only through `host`, the contract's `PluginHost` (spec § The view):
//   host.api        its own routes, `days` and `edit` (`wire.ts`)
//   host.events     `{ date }` when a day file changes, from anyone; `{}` to read every day shown again
//   host.chat.add   a block, as a chip, from the writing bar's Add to chat
//   host.notify     a refused save, tick or undo, and a reveal it cannot show
//   host.confirm    only from `leave()` (`leave.ts`)
// Inside, the pieces are:
//   days.ts     draws days and patches only what changed
//   editor.ts   writing in place, with specs.ts (blocks) and drafts.ts (new writing)
//   undo.ts     the undo stack and its toast
//   bar.ts      the writing bar
// and `page` below is what every writing session talks to. Everything a mount knows lives in this call: two mounts in
// one page share nothing, and once unmounted nothing that answers late acts.
import { addDays, daysBetween, localToday } from '../format/index.ts';
import { blocksMarkdown } from '../vendor/markdown/index.ts';
import type { PluginHost, PluginView } from '../vendor/plugin-host/plugin-host.ts';
import { createBar } from './bar.ts';
import { blockChip, daysChip } from './chips.ts';
import { shift, weekOf, type Range } from './dates.ts';
import { daySection, patchDay } from './days.ts';
import { readBlocks } from './dom-tree.ts';
import { draftAfter, entryDraft } from './drafts.ts';
import { drawView } from './draw.ts';
import { isEditing, startSession } from './editor.ts';
import { createLeave } from './leave.ts';
import { el } from './render.ts';
import { readReveal } from './reveal.ts';
import type { BlockNode, Page } from './session.ts';
import { bodySpec, headingSpec } from './specs.ts';
import { createUndo } from './undo.ts';
import { createRoutes, type Day } from './wire.ts';
import { say } from './words.ts';

export function mountJournal(root: HTMLElement, host: PluginHost): PluginView {
	const parts = drawView(root);
	const { spread, hintId } = parts;
	const routes = createRoutes(host.api);
	const live = { on: true };
	const notify = (text: string, tone: 'info' | 'error' = 'error') => void (live.on && host.notify(text, tone));
	const input = (name: string) => root.querySelector<HTMLInputElement>(`[data-range="${name}"]`)!;
	const sectionOf = (date: string) => spread.querySelector(`.day[data-date="${date}"]`);
	/** The range shown, and the days in it as last read; `seq` lets only the newest read draw. */
	const state: Range & { seq: number } = { ...weekOf(localToday()), seq: 0 };
	let shown = new Map<string, Day>();

	const page: Page = {
		edit: (e) => routes.edit(e),
		patch(day, fresh = true) {
			if (!live.on) return;
			if (shown.has(day.date)) shown.set(day.date, day);
			patchDay(day, sectionOf(day.date), fresh, hintId);
		},
		async refresh(date) {
			const r = await routes.days(date, date);
			if (r.ok && r.days[0] !== undefined) page.patch(r.days[0]);
		},
		undo: (u, label) => undo.push(u, label),
		blockAt: (date, start) => spread.querySelector<BlockNode>(`.block[data-date="${date}"][data-start="${start}"]:not(.draft)`),
		focusAt: (date, start) => page.blockAt(date, start)?.focus(),
		open(node, at = 'end') {
			if (node.classList.contains('draft')) return null;
			return startSession(node, page, node.classList.contains('entry-head') ? headingSpec(node) : bodySpec(node), at);
		},
		draftAfter: (anchor) => draftAfter(anchor, page),
		/** "Add to chat" in the writing bar: this block, as a chip the host resolves when it is sent. */
		ask(node) {
			if (node._text === undefined) return notify(say('journal.view.chip.unsaved'), 'info');
			host.chat.add(blockChip(node, node._text));
		},
		notify,
		bar: createBar(parts.bar),
		sessions: { current: null },
		hintId,
	};
	const undo = createUndo(page, parts.toast, root);
	const { unsaved, leave } = createLeave(page, (ask) => host.confirm(ask), live);

	/** Ticking a to-do outside the editor saves at once, read back from the page like any edit. */
	async function tick(box: HTMLInputElement): Promise<void> {
		const node = box.closest<BlockNode>('.block')!;
		const after = blocksMarkdown(readBlocks(node));
		const { date, start, end } = node.dataset;
		const r = await page.edit({ op: 'replace', date: date!, start: Number(start), end: Number(end), before: node._text ?? '', after });
		if (r.day) page.patch(r.day, false);
		if (r.ok) undo.push(r.undo, say(box.checked ? 'journal.view.ticked' : 'journal.view.unticked'));
		else {
			box.checked = !box.checked;
			notify(r.reason);
		}
	}

	spread.addEventListener('click', (e) => {
		const t = e.target as Element;
		// A page that breaks the rules is read only: the engine would refuse every write to it.
		if (t.closest('.day.broken') !== null) return;
		const add = t.closest('.add-entry');
		if (add !== null) return void entryDraft(add.closest<HTMLElement>('.day')!, page);
		const node = t.closest<BlockNode>('.block');
		if (node === null || isEditing(node) || t.closest('a') !== null) return;
		if (t.matches('input.todo')) return void tick(t as HTMLInputElement);
		page.open(node, { x: e.clientX, y: e.clientY });
	});
	spread.addEventListener('keydown', (e) => {
		const t = e.target as BlockNode;
		// A key the writing already took (its Enter can close this very block) is not a request to open it.
		if (e.defaultPrevented || e.key !== 'Enter' || !t.classList?.contains('block') || isEditing(t)) return;
		if (t.closest('.day.broken') !== null) return;
		e.preventDefault();
		page.open(t);
	});
	spread.addEventListener('animationend', (e) => (e.target as Element).classList.remove('fresh'));

	/** Read and draw `from`..`to`, after saving what is open; false when it did not move. */
	async function show(from: string, to: string): Promise<boolean> {
		const seq = (state.seq += 1);
		const open = page.sessions.current;
		if (open !== null && (await open.finish({ then: 'stay' })) !== null) return false;
		const r = await routes.days(from, to);
		if (!live.on || seq !== state.seq) return false;
		if (!r.ok) {
			notify(r.reason);
			return false;
		}
		Object.assign(state, { from, to });
		input('from').value = from;
		input('to').value = to;
		shown = new Map(r.days.map((d) => [d.date, d]));
		const half = Math.ceil(r.days.length / 2);
		const pages = [r.days.slice(0, half), r.days.slice(half)].map((list, i) =>
			el('article', list.map((d) => daySection(d, hintId)), { class: `page ${i === 0 ? 'left' : 'right'}` }));
		spread.replaceChildren(...pages);
		return true;
	}
	const showRange = (r: Range) => show(r.from, r.to);

	/** Every day shown, read again and patched in place: the page does not move. */
	async function reread(): Promise<void> {
		const r = await routes.days(state.from, state.to);
		if (r.ok) for (const day of r.days) page.patch(day);
	}

	const actions: Record<string, () => Promise<boolean>> = {
		prev: () => showRange(shift(state, -1)),
		next: () => showRange(shift(state, 1)),
		'this-week': () => showRange(weekOf(localToday())),
	};
	root.querySelector('.range')!.addEventListener('click', (e) => {
		const act = (e.target as Element).closest('button')?.dataset.range;
		if (act !== undefined) void actions[act]?.();
	});
	input('from').addEventListener('change', () => {
		const from = input('from').value;
		if (from !== '') void show(from, addDays(from, daysBetween(state.from, state.to) - 1));
	});
	input('to').addEventListener('change', () => {
		const to = input('to').value;
		if (to >= state.from) void show(state.from, to);
	});

	const offEvents = host.events(({ ref }) => {
		if (Object.keys(ref).length === 0) return void reread();
		if (typeof ref.date === 'string' && shown.has(ref.date)) void page.refresh(ref.date);
	});

	/** Shows what `ref` names and marks it: the block with its key, or its day when the key is gone. */
	async function reveal(ref: unknown): Promise<void> {
		const r = readReveal(ref);
		if (r === null) return notify(say('journal.view.reveal.unknown'), 'info');
		const range = 'from' in r ? r : weekOf(r.date);
		const here = 'from' in r ? r.from === state.from && r.to === state.to : shown.has(r.date);
		if (!here && !(await showRange(range))) return;
		const date = 'from' in r ? r.from : r.date;
		const block = 'key' in r && r.key !== null ? spread.querySelector(`.block[data-date="${date}"][data-key="${r.key}"]`) : null;
		const target = block ?? sectionOf(date);
		target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target?.classList.add('fresh');
	}

	void show(state.from, state.to);

	return {
		unmount() {
			// Never asks and never saves (the host called `leave()` first): open writing is closed as it was.
			live.on = false;
			page.sessions.current?.discard();
			offEvents();
			undo.dispose();
			root.replaceChildren();
			root.classList.remove('journal');
		},
		unsaved,
		leave,
		pageChip: () => daysChip(state, shown.values()),
		reveal: (ref) => void reveal(ref),
	};
}
