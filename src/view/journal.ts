// The Journal's view: a running journal of days, or one day, on a sheet of paper, kept live, written in place.
// `mountJournal(root, host)` draws only inside `root` and talks to the world only through `host`, the contract's `PluginHost` (spec § The view):
//   host.api        its own routes, `days`, `pages` and `edit` (`wire.ts`)
//   host.store      the place: the view, and the day in it (`place.ts`)
// and focus.ts marks focus a pointer gave, so the ring shows only for Tab.
//   host.events     `{ date }` when a day file changes, from anyone; `{}` to read every day shown again
//   host.chat.add   a block, as a chip, from the writing bar's Add to chat
//   host.notify     a refused save, tick or undo, and a reveal it cannot show
//   host.confirm    only from `leave()` (`leave.ts`)
//   host.pageChanged  once the first draw settles, then each time `pageChip()` would answer something else
// Inside, the pieces are:
//   views.ts    what is on the sheet: the running journal (feed.ts) or one day, and the place kept (place.ts)
//   toolbar.ts  the view, the day, and Add a page
//   days.ts     draws days and patches only what changed
//   editor.ts   writing in place, with specs.ts (blocks) and drafts.ts (new writing)
//   undo.ts     the undo stack and its toast
//   bar.ts      the writing bar
// and `page` below is what every writing session talks to. Everything a mount knows lives in this call: two mounts in
// one page share nothing, and once unmounted nothing that answers late acts.
import { addDays, isDate, localToday } from '../format/index.ts';
import { blocksMarkdown } from '../vendor/markdown/index.ts';
import type { PluginHost, PluginView } from '../vendor/plugin-host/plugin-host.ts';
import { createBar } from './bar.ts';
import { blockChip, daysChip } from './chips.ts';
import { readBlocks } from './dom-tree.ts';
import { draftAfter, entryDraft } from './drafts.ts';
import { drawView } from './draw.ts';
import { trackFocusSource } from './focus.ts';
import { isEditing, startSession } from './editor.ts';
import { createLeave } from './leave.ts';
import { openPicker } from './picker.ts';
import { readReveal } from './reveal.ts';
import type { BlockNode, Page } from './session.ts';
import { bodySpec, headingSpec } from './specs.ts';
import { createToolbar } from './toolbar.ts';
import { createUndo } from './undo.ts';
import { createViews } from './views.ts';
import { createRoutes } from './wire.ts';
import { say } from './words.ts';

export function mountJournal(root: HTMLElement, host: PluginHost): PluginView {
	const toolbar = createToolbar({
		view: (v) => void (v === views.place.view ? undefined : v === 'journal' ? views.showJournal() : views.showDay(views.place.date ?? localToday())),
		step: (n) => void views.showDay(addDays(views.place.date ?? localToday(), n)),
		go: (date) => void views.showDay(date),
		add: (date) => void addPage(date),
	});
	const parts = drawView(root, toolbar.el);
	const { paper, sheet, hintId } = parts;
	const routes = createRoutes(host.api);
	const live = { on: true };
	const notify = (text: string, tone: 'info' | 'error' = 'error') => void (live.on && host.notify(text, tone));

	const page: Page = {
		edit: (e) => routes.edit(e),
		patch(day, fresh = true) {
			if (live.on) views.patch(day, fresh);
		},
		async refresh(date) {
			const r = await routes.days(date, date);
			if (r.ok && r.days[0] !== undefined) page.patch(r.days[0]);
		},
		undo: (u, label) => undo.push(u, label),
		relayout: () => void (live.on && views.relayout()),
		blockAt: (date, start) => sheet.querySelector<BlockNode>(`.block[data-date="${date}"][data-start="${start}"]:not(.draft)`),
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
	/** The chip for the days on show: the recent days or the one day, never counting an older page below them; null before any. */
	function pageChip() {
		const { range } = views;
		if (range === null) return null;
		return daysChip(range, [...views.shown.values()].filter((d) => d.date >= range.from && d.date <= range.to));
	}
	/**
	 * What `pageChip()` answered when the host was last told, as JSON; undefined until the first draw settles. Views say a
	 * change to what is on show often (every patch, every scroll that moves the place); the host is told only when the
	 * chip is not what it was, so its Add to chat follows the chip and nothing else.
	 */
	let toldChip: string | undefined;
	function chipMayHaveChanged(): void {
		if (!live.on || toldChip === undefined) return;
		const now = JSON.stringify(pageChip());
		if (now === toldChip) return;
		toldChip = now;
		host.pageChanged();
	}
	const views = createViews({ paper, sheet, routes, page, toolbar, store: host.store, live, notify, onShow: chipMayHaveChanged });
	const undo = createUndo(page, parts.toast, root);
	const offFocus = trackFocusSource(root);
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

	/** A new entry on `date`'s page (made when it has none), wherever the day is. */
	async function addPage(date: string): Promise<void> {
		const section = await views.reach(date);
		if (section === null || section.classList.contains('broken')) return;
		section.scrollIntoView({ block: 'start', behavior: 'smooth' });
		entryDraft(section, page);
	}

	sheet.addEventListener('click', (e) => {
		const t = e.target as Element;
		const gap = t.closest<HTMLElement>('.gap-marker');
		if (gap !== null && t.closest('.gap-add') !== null) {
			const { from, to } = gap.dataset as { from: string; to: string };
			// One day between: that is the day. More: the picker, held to the days between.
			if (from === to) return void addPage(from);
			return openPicker(gap.querySelector<HTMLInputElement>('input.picker')!, { value: to, min: from, max: to });
		}
		if (t.closest('.feed-more') !== null) return void views.readOlder();
		// In Day, a day with no page is a blank page: a press anywhere on it starts writing.
		if (views.place.view === 'day' && t.closest('button, a, input') === null) {
			const blank = sheet.querySelector<HTMLElement>('.day.gap:not(.drafting)');
			if (blank !== null && (t === sheet || blank.contains(t))) return void entryDraft(blank, page);
		}
		// A page that breaks the rules is read only: the engine would refuse every write to it.
		if (t.closest('.day.broken') !== null) return;
		const add = t.closest('.add-entry');
		if (add !== null) return void entryDraft(add.closest<HTMLElement>('.day')!, page);
		const node = t.closest<BlockNode>('.block');
		if (node === null || isEditing(node) || t.closest('a') !== null) return;
		if (t.matches('input.todo')) return void tick(t as HTMLInputElement);
		page.open(node, { x: e.clientX, y: e.clientY });
	});
	sheet.addEventListener('change', (e) => {
		const field = e.target as HTMLInputElement;
		const gap = field.closest<HTMLElement>('.gap-marker');
		if (gap === null || !field.matches('input.picker')) return;
		field.classList.remove('shown');
		const { from, to } = gap.dataset as { from: string; to: string };
		if (field.value >= from && field.value <= to) void addPage(field.value);
	});
	sheet.addEventListener('keydown', (e) => {
		const t = e.target as BlockNode;
		// A key the writing already took (its Enter can close this very block) is not a request to open it.
		if (e.defaultPrevented || e.key !== 'Enter' || !t.classList?.contains('block') || isEditing(t)) return;
		if (t.closest('.day.broken') !== null) return;
		e.preventDefault();
		page.open(t);
	});
	sheet.addEventListener('animationend', (e) => (e.target as Element).classList.remove('fresh'));
	const onScroll = () => views.scrolled();
	paper.addEventListener('scroll', onScroll, { passive: true });

	const offEvents = host.events(({ ref }) => {
		if (Object.keys(ref).length === 0) return void views.reread();
		if (typeof ref.date === 'string' && isDate(ref.date)) void views.changed(ref.date);
	});

	/** Shows what `ref` names and marks it: the block with its key, or its day when the key is gone. */
	async function reveal(ref: unknown): Promise<void> {
		const r = readReveal(ref);
		if (r === null) return notify(say('journal.view.reveal.unknown'), 'info');
		const one = 'from' in r ? (r.from === r.to ? r.from : null) : r.date;
		const section = one !== null ? await views.reach(one) : await views.reachRange(r as { from: string; to: string });
		if (section === null) return;
		const key = 'key' in r ? r.key : null;
		const block = key !== null ? sheet.querySelector(`.block[data-date="${one}"][data-key="${key}"]`) : null;
		const target = block ?? section;
		target.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target.classList.add('fresh');
	}

	// The host is told once the first draw settles, read or refused, and from then on whenever the chip changes.
	void views.open().finally(() => {
		if (!live.on) return;
		toldChip = JSON.stringify(pageChip());
		host.pageChanged();
	});

	return {
		unmount() {
			// Never asks and never saves (the host called `leave()` first): open writing is closed as it was.
			live.on = false;
			page.sessions.current?.discard();
			offEvents();
			undo.dispose();
			views.dispose();
			offFocus();
			paper.removeEventListener('scroll', onScroll);
			root.replaceChildren();
			root.classList.remove('journal');
		},
		unsaved,
		leave,
		pageChip,
		reveal: (ref) => void reveal(ref),
	};
}
