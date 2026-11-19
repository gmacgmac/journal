// The page's half of a stand-in host (`npm run dev`, see dev/server.ts): the contract's `PluginHost` for the real
// `mount`, the way nclite's pane gives it (nclite `app/src/lib/plugins/host.ts`), plus switches to try the Journal in
// its own colours or a bot's, light or dark, wide or in a narrow pane. Never shipped.
import type { Chip, ConfirmAsk, PluginEvent, PluginHost } from '../src/vendor/plugin-host/plugin-host.ts';
import { mount } from '../src/view/view.ts';
import type { PrintAsk } from '../src/view/print.ts';
import { installOverlayScroll } from './overlay-scroll/overlay-scroll.ts';
import './overlay-scroll/overlay-scroll.css';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const pane = $<HTMLElement>('#pane');
const root = $<HTMLElement>('#root');
const logList = $<HTMLOListElement>('#log');

function log(kind: string, text: string): void {
	const li = document.createElement('li');
	li.dataset.kind = kind;
	li.textContent = `${kind}: ${text}`;
	logList.prepend(li);
}

// ─── Colours: what nclite's pane sets on its root (`.root`, nclite `Pane.svelte`), from its warm palette ───────────
// The values are nclite's `app.css` (warm) and `bot-colours.ts` (`BOT_COLOURS`) as of 2026-11-09, light then dark.
// A bot colour also moves nclite's grounds to its own palette; here the grounds stay warm, which is close enough to
// judge the paper by.
type Pair = [light: string, dark: string];
const ACCENTS: Record<string, { accent: Pair; strong: Pair }> = {
	orange: { accent: ['#e86a38', '#ff8a4f'], strong: ['#c4501f', '#d2602f'] },
	cyan: { accent: ['#0d6b9e', '#5ec7f5'], strong: ['#0a5379', '#315e80'] },
	green: { accent: ['#12804a', '#3fd488'], strong: ['#0f6b3c', '#1d7a4b'] },
	violet: { accent: ['#7048e8', '#a78bfa'], strong: ['#5b34c7', '#6d4fd1'] },
	pink: { accent: ['#d81b60', '#ff6b9e'], strong: ['#a8184f', '#b03066'] },
};
const GROUNDS: Record<string, Pair> = {
	'--host-canvas': ['#faf6ef', '#13100f'],
	'--host-surface': ['#fffdfa', '#1c1916'],
	'--host-surface-sunken': ['color-mix(in srgb, #fffdfa 50%, #f5eee3)', 'color-mix(in srgb, #1c1916 50%, #25211e)'],
	'--host-ink': ['#141414', '#fafafa'],
	'--host-ink-muted': ['#63523d', '#dcd6d2'],
	'--host-line': ['#e9ddcc', '#332d29'],
	'--host-line-strong': ['#d8c8b0', '#463f3a'],
	'--host-on-accent': ['#fff', '#fff'],
};
const COLOUR_PROPS = [...Object.keys(GROUNDS), '--host-accent', '--host-accent-strong', '--host-accent-fill', '--host-accent-fill-hover'];

function dress(): void {
	const look = $<HTMLInputElement>('input[name=look]:checked').value;
	const mode = $<HTMLInputElement>('input[name=mode]:checked').value as 'light' | 'dark';
	const width = $<HTMLInputElement>('input[name=width]:checked').value;
	document.documentElement.dataset.mode = mode;
	pane.dataset.width = width;
	// Always given, as nclite gives them whichever colours the plugin wears: the mode and the faces.
	pane.style.setProperty('--host-color-scheme', mode);
	pane.style.setProperty('--host-font', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif");
	pane.style.setProperty('--host-font-mono', "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace");
	// The page's serif, to compare faces: set on the Journal's own root, where `--journal-serif` is declared.
	const serif = $<HTMLSelectElement>('select[name=serif]').value;
	if (serif === '') root.style.removeProperty('--journal-serif');
	else root.style.setProperty('--journal-serif', serif);
	for (const p of COLOUR_PROPS) pane.style.removeProperty(p);
	if (look !== 'bot') return;
	const a = ACCENTS[$<HTMLSelectElement>('select[name=accent]').value]!;
	// As nclite gives them: each colour a light and dark pair, the mode chosen by `--host-color-scheme` (Pane.svelte), so a
	// plugin can use either mode whatever the app is in (a print in the theme does).
	const both = ([light, dark]: Pair) => `light-dark(${light}, ${dark})`;
	for (const [p, pair] of Object.entries(GROUNDS)) pane.style.setProperty(p, both(pair));
	pane.style.setProperty('--host-accent', both(a.accent));
	// nclite's `--link`: in light, the accent mixed toward the text; in dark, the accent.
	pane.style.setProperty('--host-accent-strong', both([`color-mix(in srgb, ${a.accent[0]} 65%, ${GROUNDS['--host-ink']![0]})`, a.accent[1]]));
	pane.style.setProperty('--host-accent-fill', both(a.strong));
	pane.style.setProperty('--host-accent-fill-hover', both([`color-mix(in srgb, ${a.strong[0]} 88%, black)`, `color-mix(in srgb, ${a.strong[1]} 88%, black)`]));
}

// Remembered on this page only, so a reload keeps what was being looked at.
const SAVED = 'journal-dev-switches';
try {
	const saved = JSON.parse(localStorage.getItem(SAVED) ?? '{}') as Record<string, string>;
	for (const [name, value] of Object.entries(saved)) {
		const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`select[name=${name}]`) ?? document.querySelector<HTMLInputElement>(`[name=${name}][value="${value}"]`);
		if (el instanceof HTMLInputElement) el.checked = true;
		else if (el instanceof HTMLSelectElement) el.value = value;
	}
} catch { /* a page with no storage starts on the defaults */ }
$('.dev-bar').addEventListener('change', () => {
	const form = Object.fromEntries(['look', 'mode', 'width', 'accent', 'serif'].map((n) => [n,
		(document.querySelector<HTMLInputElement>(`input[name=${n}]:checked`) ?? document.querySelector<HTMLSelectElement>(`select[name=${n}]`))?.value ?? '']));
	try { localStorage.setItem(SAVED, JSON.stringify(form)); } catch { /* fine */ }
	dress();
});
dress();

// ─── The host ────────────────────────────────────────────────────────────────────────────────────────────────────
const listeners = new Set<(e: PluginEvent) => void>();
const stream = new EventSource('/api/events');
stream.onmessage = (m) => {
	const event: PluginEvent = { plugin: 'journal', ref: JSON.parse(m.data as string) };
	if (Object.keys(event.ref).length > 0) log('event', JSON.stringify(event.ref));
	for (const l of listeners) l(event);
};

const dialog = $<HTMLDialogElement>('#confirm');
function confirmAsk(ask: ConfirmAsk): Promise<boolean> {
	dialog.querySelector('h2')!.textContent = ask.heading;
	dialog.querySelector('p')!.textContent = ask.body;
	dialog.querySelector<HTMLButtonElement>('.go')!.textContent = ask.confirm;
	dialog.showModal();
	return new Promise((done) => dialog.addEventListener('close', () => done(dialog.returnValue === 'yes'), { once: true }));
}

/** nclite's coming `print` (its handover, 2026-11-19), stood in for: the element shown alone, Print opens the browser's
 * print window, and the promise settles once the stand-in closes, printed or not. */
const printWindow = $<HTMLDialogElement>('#print');
function printAsk(ask: PrintAsk): Promise<void> {
	log('print', ask.title);
	printWindow.querySelector('strong')!.textContent = ask.title;
	printWindow.querySelector('.paper-preview')!.replaceChildren(ask.content);
	const before = document.title;
	printWindow.showModal();
	const go = printWindow.querySelector<HTMLButtonElement>('.go')!;
	const close = printWindow.querySelector<HTMLButtonElement>('.close')!;
	return new Promise((done) => {
		// To paper from the page's own flow, then back into the preview.
		const out = $<HTMLElement>('#print-out');
		const print = () => {
			document.title = ask.title;
			out.replaceChildren(ask.content);
			window.print();
			printWindow.querySelector('.paper-preview')!.replaceChildren(ask.content);
			document.title = before;
		};
		go.addEventListener('click', print);
		close.addEventListener('click', () => printWindow.close(), { once: true });
		printWindow.addEventListener('close', () => {
			go.removeEventListener('click', print);
			printWindow.querySelector('.paper-preview')!.replaceChildren();
			done();
		}, { once: true });
	});
}

const PREFIX = 'journal-dev-store:';
const chip = (c: Chip) => `${c.label}${c.detail ? ` (${c.detail})` : ''}`;
// `print` is in nclite's proposal, not yet in the vendored contract (see src/view/print.ts).
const host: PluginHost & { print(ask: PrintAsk): Promise<void> } = {
	api: (path, init) => fetch(`/api/journal/${path}`, init),
	events(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	chat: {
		attach: (key, c) => log('chat.attach', `${key} ${c === null ? 'removed' : chip(c)}`),
		add: (c) => log('chat.add', chip(c)),
		send: async () => null,
		status: { now: 'idle', on: () => () => {} },
		reveal: (ref) => log('chat.reveal', JSON.stringify(ref)),
		hasLine: () => false,
	},
	settings: { get: () => undefined, on: () => () => {} },
	notify: (text, tone = 'info') => log(`notify ${tone}`, text),
	confirm: confirmAsk,
	print: printAsk,
	store: {
		get(key) {
			try { return localStorage.getItem(PREFIX + key); } catch { return null; }
		},
		set(key, value) {
			try { localStorage.setItem(PREFIX + key, value); } catch { /* it may lose anything */ }
		},
	},
	imageRoute: '/api/journal-images/',
	// As nclite's pane does: the chip read again in a microtask, so a run of calls logs once with what it now is.
	pageChanged() {
		if (rechip) return;
		rechip = true;
		queueMicrotask(() => {
			rechip = false;
			const c = view.pageChip();
			log('pageChanged', c === null ? 'nothing to add' : chip(c));
		});
	},
};
let rechip = false;

// The view, on `window.journal` for the console: `journal.pageChip()`, `journal.reveal({ date })`, `journal.leave()`.
const view = mount(root, host);
Object.assign(window, { journal: view });

// nclite's one scrollbar for every scrolling area, as its layout installs it (dev/overlay-scroll/README.md).
installOverlayScroll(document);
