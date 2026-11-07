// The Journal's view: a range of days as facing pages, kept live, written in place. `mountJournal(root, app)` draws
// only inside `root` and talks to the world only through `app` (`app.ts` § JournalApp):
//   app.api(path, init)   its own routes: GET /days, POST /edit
//   app.events(fn)        { ref: { date } } whenever a day file changes, from anyone
//   app.addToChat(chip)   a block or the days shown, as a reference
//   app.settings          { get(key), on(fn) }: paper, week-start
// Inside, the pieces are:
//   days.ts     draws days and patches only what changed
//   editor.ts   writing in place, with specs.ts (blocks) and drafts.ts (new writing)
//   undo.ts     the undo stack and its toast
//   bar.ts      the writing bar
// and `page` below is the host every writing session talks to. Everything a mount knows lives in this call: two
// mounts in one page share nothing.
import { blocksMarkdown } from '../vendor/markdown/index.ts';
import type { Day, EditResult, JournalApp, JournalView } from './app.ts';
import { createBar } from './bar.ts';
import { addDays, localToday, shift, shortDate, snippet, spanOf, weekOf, weekStartOf, type Range } from './dates.ts';
import { daySection, patchDay } from './days.ts';
import { readBlocks } from './dom-tree.ts';
import { draftAfter, entryDraft } from './drafts.ts';
import { drawView } from './draw.ts';
import { finishOpen, isEditing, startSession } from './editor.ts';
import { el } from './render.ts';
import type { BlockNode, Page } from './session.ts';
import { bodySpec, headingSpec } from './specs.ts';
import { createUndo } from './undo.ts';

/** Where the sample journal starts, so the proof opens on writing rather than on today. */
export const SAMPLE_WEEK = '2026-09-28';

/** The entry a block sits under, read from the page: its time and title, or null. */
function entryOf(node: BlockNode): string | null {
	let head: Element | null = node.classList.contains('entry-head') ? node : node.previousElementSibling;
	while (head !== null && !head.classList.contains('entry-head')) head = head.previousElementSibling;
	return head === null ? null : ((head as BlockNode)._text ?? '').replace(/^##\s+/, '');
}

export function mountJournal(root: HTMLElement, app: JournalApp): JournalView {
	const parts = drawView(root);
	const { spread, paper, hintId } = parts;
	const range = (name: string) => root.querySelector<HTMLInputElement>(`[data-range="${name}"]`)!;
	const state: Range = { from: SAMPLE_WEEK, to: addDays(SAMPLE_WEEK, 6) };
	const sectionOf = (date: string) => spread.querySelector(`.day[data-date="${date}"]`);
	const weekStart = () => weekStartOf(app.settings.get('week-start'));
	const edit = (e: unknown) => app.api('/edit', { method: 'POST', body: e }) as Promise<EditResult>;

	const page: Page = {
		edit,
		patch: (day, fresh = true) => void patchDay(day, sectionOf(day.date), fresh, hintId),
		refresh: async (date) => {
			const days = await app.api(`/days?from=${date}&to=${date}`) as Day[];
			page.patch(days[0]!);
		},
		undo: (u, label) => undo.push(u, label),
		blockAt: (date, start) => spread.querySelector<BlockNode>(`.block[data-date="${date}"][data-start="${start}"]:not(.draft)`),
		focusAt: (date, start) => page.blockAt(date, start)?.focus(),
		open(node, at = 'end') {
			if (node.classList.contains('draft')) return null;
			return startSession(node, page, node.classList.contains('entry-head') ? headingSpec(node) : bodySpec(node), at);
		},
		draftAfter: (anchor) => draftAfter(anchor, page),
		/** "Add to chat" in the writing bar: this block, as a reference the host resolves when it is sent. */
		ask(node) {
			if (node._text === undefined) return undo.notify('Save this first; then it can go to the chat.');
			const date = node.dataset.date!;
			const entry = entryOf(node);
			const label = entry === null ? shortDate(date) : `${shortDate(date)} · ${entry}`;
			app.addToChat({ kind: 'block', ref: { date, key: node.dataset.key! }, label, detail: snippet(node._text) });
		},
		bar: createBar(parts.bar),
		sessions: { current: null },
		hintId,
	};
	const undo = createUndo(page, parts.toast, root);

	/** Ticking a to-do outside the editor saves at once, read back from the page like any edit. */
	async function tick(box: HTMLInputElement): Promise<void> {
		const node = box.closest<BlockNode>('.block')!;
		const after = blocksMarkdown(readBlocks(node));
		const r = await edit({ op: 'replace', date: node.dataset.date, start: Number(node.dataset.start), end: Number(node.dataset.end), before: node._text, after });
		if (r.day) page.patch(r.day, false);
		if (r.ok) undo.push(r.undo, box.checked ? 'Done.' : 'Not done.');
		else {
			box.checked = !box.checked;
			undo.notify(r.reason);
		}
	}

	spread.addEventListener('click', (e) => {
		const t = e.target as Element;
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
		e.preventDefault();
		page.open(t);
	});
	spread.addEventListener('animationend', (e) => (e.target as Element).classList.remove('fresh'));

	async function show(from: string, to: string): Promise<void> {
		const days = await app.api(`/days?from=${from}&to=${to}`);
		if (!Array.isArray(days)) return;
		Object.assign(state, { from, to });
		range('from').value = from;
		range('to').value = to;
		const half = Math.ceil(days.length / 2);
		const pages = [days.slice(0, half), days.slice(half)].map((list: Day[], i) =>
			el('article', list.map((d) => daySection(d, hintId)), { class: `page ${i === 0 ? 'left' : 'right'}` }));
		spread.replaceChildren(...pages);
	}
	const showRange = (r: Range) => show(r.from, r.to);

	const span = () => spanOf(state.from, state.to);
	const actions: Record<string, () => Promise<void>> = {
		prev: () => showRange(shift(state, -1)),
		next: () => showRange(shift(state, 1)),
		'this-week': () => showRange(weekOf(localToday(), weekStart())),
		'last-7': () => show(addDays(localToday(), -6), localToday()),
		sample: () => show(SAMPLE_WEEK, addDays(SAMPLE_WEEK, 6)),
	};
	root.querySelector('.range')!.addEventListener('click', (e) => {
		const act = (e.target as Element).closest('button')?.dataset.range;
		if (act !== undefined) void actions[act]?.();
	});
	range('from').addEventListener('change', () => range('from').value && show(range('from').value, addDays(range('from').value, span() - 1)));
	range('to').addEventListener('change', () => range('to').value >= state.from && show(state.from, range('to').value));

	const applySettings = () => (paper.dataset.paper = app.settings.get('paper') ?? 'follow');
	applySettings();
	const offSettings = app.settings.on(applySettings);
	const offEvents = app.events(({ ref }) => {
		if (ref.date >= state.from && ref.date <= state.to) void page.refresh(ref.date);
	});

	void show(state.from, state.to);

	return {
		unmount() {
			// Writing in progress is saved, not dropped, when the pane closes.
			finishOpen(page);
			offEvents();
			offSettings();
			undo.dispose();
			root.replaceChildren();
			root.classList.remove('journal');
		},
		/** The days shown, as one chip: what "Add page to chat" sends. */
		pageChip: () => ({
			kind: 'days',
			ref: { from: state.from, to: state.to },
			label: `${shortDate(state.from)} – ${shortDate(state.to)}`,
			detail: `${span()} days`,
		}),
		/** Show and mark what a chip names: its day comes into view, the block flashes. */
		async reveal(ref) {
			const date = ref.date ?? ref.from;
			if (date === undefined) return;
			if (date < state.from || date > state.to) await showRange(weekOf(date, weekStart()));
			const target = (ref.key && spread.querySelector(`.block[data-key="${ref.key}"]`)) || sectionOf(date);
			target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			target?.classList.add('fresh');
		},
	};
}
