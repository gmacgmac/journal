// SAVE AS PDF (nclite's handover, 2026-11-20; ADR-0381 on nclite's side). The Journal owns the Save as PDF… control and
// what goes in the PDF; the host owns the rest: the save panel, the page (plain: a 10 mm white margin; light or dark: a
// 12 mm band of the element's own ground at every page's top and foot), and hiding the rest of the app. The person
// chooses the day on screen, a range of days, or everything, and the colours: black on white (the default), or the
// theme's own, light or dark, whatever mode the app is in (GM, 2026-11-19). The Journal reads those days, builds one
// element for paper (`journal journal-print`: each day under its date, its entries as they read, no control of any kind,
// links as their words), and hands it to `host.savePdf` with the look. The control is drawn only when the host can save a
// PDF.
//
// The theme travels with the element: the host's colours are copied onto it as the host gives them (nclite gives each as
// a light and dark pair), and its colour scheme is set to the mode chosen. The host reads the page's ground from this
// element's background, so the paper styles keep it the ground wanted (`src/view/css/print.css`).
import { MAX_PAGES, MAX_RANGE_DAYS, addDays, dateTitle, entryOf } from '../format/index.ts';
import { HOST_PROPERTIES, type PluginHost, type PluginStore, type PdfAsk, type PrintLook } from '../vendor/plugin-host/plugin-host.ts';
import { hasPage, writingOf } from './days.ts';
import { dayMonth, shortDate } from './dates.ts';
import type { DayPicker } from './day-picker.ts';
import { icon } from './icons.ts';
import { el, renderMarkdown } from './render.ts';
import type { Day, Routes } from './wire.ts';
import { say } from './words.ts';

export type { PrintLook };

/** A print job as the Journal always asks it: a title, its own element, and the look the person chose. */
export type PdfSaver = (ask: Required<Pick<PdfAsk, 'title' | 'content' | 'look'>>) => Promise<void>;

/** The host's `savePdf`, when it can save a PDF; null when it cannot (then no Save as PDF control is drawn at all). */
export function pdfSaverOf(host: PluginHost): PdfSaver | null {
	const save = host.savePdf;
	return typeof save === 'function' ? (ask) => save.call(host, ask) : null;
}

/** The three looks, in the order the panel offers them. */
export const PRINT_LOOKS: readonly PrintLook[] = ['plain', 'light', 'dark'];

const LOOK_KEY = 'printLook';

/** The colours chosen last on this device (a convenience the store may lose); black on white the first time. */
export function readLook(store: PluginStore): PrintLook {
	try {
		const kept = store.get(LOOK_KEY);
		return PRINT_LOOKS.includes(kept as PrintLook) ? (kept as PrintLook) : 'plain';
	} catch {
		return 'plain';
	}
}

function keepLook(store: PluginStore, look: PrintLook): void {
	try {
		store.set(LOOK_KEY, look);
	} catch {
		// The store may refuse; the choice is a convenience.
	}
}

/** The host's properties a print in the theme takes with it: its faces and colours, not its text size (paper has its own). */
const THEME_PROPERTIES = HOST_PROPERTIES.filter((p) => p !== '--host-text-scale' && p !== '--host-color-scheme');

/** What the person chose to print. */
export type SaveChoice = { kind: 'day'; date: string } | { kind: 'range'; from: string; to: string } | { kind: 'all' };

/** The date everything is read before: past any page. A longer range, and every page, are read in parts within the routes'
 * limits (`MAX_RANGE_DAYS`, `MAX_PAGES`). */
const NO_LATER = '9999-12-31';

/** The days `choice` names that have a page, oldest first, as a printed journal reads; or why they could not be read. */
export async function daysToSave(routes: Routes, choice: SaveChoice): Promise<{ ok: true; days: Day[] } | { ok: false; reason: string }> {
	const days: Day[] = [];
	if (choice.kind === 'all') {
		for (let before: string | null = NO_LATER; before !== null;) {
			const r = await routes.pages(before, MAX_PAGES);
			if (!r.ok) return r;
			days.push(...r.days);
			before = r.next;
		}
		days.reverse();
	} else {
		const [from, to] = choice.kind === 'day' ? [choice.date, choice.date] : [choice.from, choice.to];
		for (let at = from; at <= to; at = addDays(at, MAX_RANGE_DAYS)) {
			const end = addDays(at, MAX_RANGE_DAYS - 1);
			const r = await routes.days(at, end < to ? end : to);
			if (!r.ok) return r;
			days.push(...r.days);
		}
	}
	return { ok: true, days: days.filter(hasPage) };
}

/** The print's title: the day, the range, or the whole journal. */
export function pdfTitle(choice: SaveChoice): string {
	if (choice.kind === 'day') return say('journal.view.pdf.titleDay', { date: dateTitle(choice.date) });
	if (choice.kind === 'all') return say('journal.view.pdf.titleAll');
	const sameYear = choice.from.slice(0, 4) === choice.to.slice(0, 4);
	return say('journal.view.pdf.titleRange', { from: sameYear ? dayMonth(choice.from) : dateTitle(choice.from), to: dateTitle(choice.to) });
}

/** Writing for paper: links and pictures as their words, a to-do's box as a printed box, nothing that can be pressed. */
function forPaper(nodes: HTMLElement[]): HTMLElement[] {
	const holder = el('div', nodes);
	for (const a of holder.querySelectorAll('a, [data-href], [data-src]')) a.replaceWith(el('span', [a.textContent ?? '']));
	for (const box of holder.querySelectorAll<HTMLInputElement>('input.todo')) {
		box.replaceWith(el('span', [box.hasAttribute('checked') ? '☑ ' : '☐ '], { class: 'print-box', 'aria-hidden': 'true' }));
	}
	for (const control of holder.querySelectorAll('button, input, select, textarea')) control.remove();
	return [...holder.children] as HTMLElement[];
}

/**
 * The element for paper: each day under its date heading, its entries' times, titles and writing as they read. In the
 * theme (`look` light or dark), the host's colours are read from `source` (the Journal's root, where the host sets them)
 * and set on the element, with the chosen mode.
 */
export function printContent(days: readonly Day[], look: PrintLook = 'plain', source: Element | null = null): HTMLElement {
	const content = el('div', [], { class: 'journal journal-print', 'data-look': look });
	if (look !== 'plain') {
		const given = source === null || typeof getComputedStyle !== 'function' ? null : getComputedStyle(source);
		for (const p of THEME_PROPERTIES) {
			const value = given?.getPropertyValue(p).trim() ?? '';
			if (value !== '') content.style.setProperty(p, value);
		}
		content.style.setProperty('--host-color-scheme', look);
	}
	for (const day of days) {
		const page = el('article', [el('h2', [day.title], { class: 'print-date' })], { class: 'print-day' });
		// Each entry is one piece, kept on one page where it fits (journal.css); one longer than a page breaks between its
		// blocks, never inside a paragraph or an item.
		let item: HTMLElement = page;
		for (const b of writingOf(day)) {
			const entry = entryOf(b.text);
			if (entry === null) {
				item.append(el('div', forPaper(renderMarkdown(b.text)), { class: 'print-block' }));
				continue;
			}
			const head = el('h3', [], { class: 'print-entry' });
			if (entry.time !== null) head.append(el('span', [entry.time], { class: 'print-time' }));
			if (entry.title !== null) head.append(el('span', forPaper([el('span', [...renderMarkdown(entry.title)[0]!.childNodes])]), { class: 'print-title' }));
			item = el('section', [head], { class: 'print-item' });
			page.append(item);
		}
		content.append(page);
	}
	return content;
}

let panels = 0;

const LOOK_WORDS = { plain: 'journal.view.pdf.plain', light: 'journal.view.pdf.light', dark: 'journal.view.pdf.dark' } as const;

export interface SavePdfDeps {
	saver: PdfSaver;
	routes: Routes;
	picker: DayPicker;
	/** Where the colours chosen last are kept. */
	store: PluginStore;
	/** The Journal's root: the host's colours are read from it for a print in the theme. */
	source: HTMLElement;
	/** The day on screen: Day's day, or the running journal's day at the top (today when it is at the top). */
	dayOnScreen(): string;
	today(): string;
	/** A PDF is being saved (the control waits), or it is done. */
	busy(on: boolean): void;
	notify(text: string, tone?: 'info' | 'error'): void;
	live: { readonly on: boolean };
}

/** Save as PDF…: its choices, then the days read, built for paper and handed to the host; one PDF at a time. */
export function createSavePdf(d: SavePdfDeps) {
	let running = false;
	/** This mount's own ids for the panel's two section names. */
	const id = `journal-pdf-${(panels += 1)}`;

	let look = readLook(d.store);

	async function run(choice: SaveChoice): Promise<void> {
		if (running) return;
		running = true;
		d.busy(true);
		try {
			const read = await daysToSave(d.routes, choice);
			if (!d.live.on) return;
			if (!read.ok) return d.notify(read.reason);
			if (read.days.length === 0) return d.notify(say('journal.view.pdf.nothing'), 'info');
			// Built for this PDF alone, and let go once the host is done with it, saved or cancelled.
			await d.saver({ title: pdfTitle(choice), content: printContent(read.days, look, d.source), look });
		} catch {
			// Only a print that could not start rejects: a cancelled one resolves.
			if (d.live.on) d.notify(say('journal.view.pdf.failed'), 'error');
		} finally {
			running = false;
			if (d.live.on) d.busy(false);
		}
	}

	/** The colours, as one choice of three under the days: kept for next time as soon as one is picked. */
	/**
	 * The colours: three small pages to choose from, each drawn in its own colours (black on white, and the theme's paper,
	 * date and writing, light and dark), the one chosen ringed. A radio group: arrows move between them.
	 */
	function looks(): HTMLElement {
		const option = (l: PrintLook) => {
			const page = el('span', [el('span', [], { class: 'sw-date' }), el('span', [], { class: 'sw-line' }), el('span', [], { class: 'sw-line sw-short' })], {
				class: 'pdf-swatch', 'aria-hidden': 'true',
			});
			return el('button', [page, el('span', [say(LOOK_WORDS[l])], { class: 'pdf-swatch-name' })], {
				type: 'button', role: 'radio', 'data-look': l, 'aria-checked': String(l === look), tabindex: l === look ? '0' : '-1',
			});
		};
		const group = el('div', PRINT_LOOKS.map(option), { class: 'pdf-looks', role: 'radiogroup', 'aria-labelledby': `${id}-looks` });
		group.addEventListener('keydown', (e) => {
			if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
			e.preventDefault();
			const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
			const next = PRINT_LOOKS[(PRINT_LOOKS.indexOf(look) + step + PRINT_LOOKS.length) % PRINT_LOOKS.length]!;
			choose(next, group);
			group.querySelector<HTMLElement>(`[data-look="${next}"]`)?.focus();
		});
		return el('div', [el('div', [say('journal.view.pdf.look')], { class: 'pdf-section', id: `${id}-looks` }), group]);
	}

	function choose(l: PrintLook, within: HTMLElement): void {
		look = l;
		keepLook(d.store, l);
		for (const b of within.querySelectorAll<HTMLElement>('[data-look]')) {
			b.setAttribute('aria-checked', String(b.dataset.look === l));
			b.tabIndex = b.dataset.look === l ? 0 : -1;
		}
	}

	/**
	 * A choice with nothing to print says so in place of its note, and cannot be pressed (GM, 2026-11-19): the day on
	 * screen when it has no page, and every choice when the journal has none. Read as the panel opens.
	 */
	async function markEmpty(choices: HTMLElement, day: string): Promise<void> {
		const [one, any] = await Promise.all([d.routes.days(day, day), d.routes.pages(NO_LATER, 1)]);
		const none = any.ok && any.days.length === 0;
		const empty = [
			...(none || (one.ok && one.days[0] !== undefined && !hasPage(one.days[0])) ? ['day'] : []),
			...(none ? ['range', 'all'] : []),
		];
		for (const kind of empty) {
			const b = choices.querySelector<HTMLButtonElement>(`[data-choice="${kind}"]`);
			if (b === null || !b.isConnected) continue;
			const moveFocus = b === document.activeElement;
			b.disabled = true;
			const note = b.querySelector('.pdf-note')!;
			note.replaceChildren(say('journal.view.pdf.empty'));
			note.classList.remove('pdf-more');
			note.removeAttribute('aria-hidden');
			if (moveFocus) [...choices.querySelectorAll<HTMLButtonElement>('button')].find((x) => !x.disabled)?.focus();
		}
	}

	/** The panel under the Save as PDF… button: the colours first, then what to save, which saves at once. */
	function open(anchor: HTMLElement): void {
		const day = d.dayOnScreen();
		const choice = (words: string, kind: string, note: Node) =>
			el('button', [el('span', [words]), note], { type: 'button', 'data-choice': kind });
		const choices = el('div', [
			choice(say('journal.view.pdf.day'), 'day', el('span', [shortDate(day)], { class: 'pdf-note' })),
			choice(say('journal.view.pdf.range'), 'range', el('span', [icon('chevron')], { class: 'pdf-note pdf-more', 'aria-hidden': 'true' })),
			choice(say('journal.view.pdf.all'), 'all', el('span', [], { class: 'pdf-note' })),
		], { class: 'pdf-choices', role: 'group', 'aria-labelledby': `${id}-what` });
		const menu = el('div', [
			looks(),
			el('div', [el('div', [say('journal.view.pdf.what')], { class: 'pdf-section', id: `${id}-what` }), choices]),
		], { class: 'pdf-menu' });
		void markEmpty(choices, day);
		menu.addEventListener('click', (e) => {
			const picked = (e.target as Element).closest<HTMLElement>('[data-look]');
			if (picked !== null) return choose(picked.dataset.look as PrintLook, menu);
			const kind = (e.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;
			if (kind === undefined) return;
			d.picker.close();
			if (kind === 'day') return void run({ kind: 'day', date: day });
			if (kind === 'all') return void run({ kind: 'all' });
			// A range: the first day, then the last, no later than today and no earlier than the first.
			const today = d.today();
			d.picker.calendar(anchor, {
				value: day, max: today, align: 'end', label: say('journal.view.pdf.from'),
				onPick: (from) => d.picker.calendar(anchor, {
					value: from > day ? from : day, min: from, max: today, align: 'end', label: say('journal.view.pdf.to'),
					onPick: (to) => void run({ kind: 'range', from, to }),
				}),
			});
		});
		d.picker.panel(anchor, menu, say('journal.view.pdf.menu'), () => choices.querySelector<HTMLElement>('button')?.focus());
	}

	return { open };
}
