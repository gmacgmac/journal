// The page's half of a stand-in host (`npm run dev`, see dev/server.ts): the contract's `PluginHost` for the real
// `mount`, the way nclite's pane gives it (nclite `app/src/lib/plugins/host.ts`), plus switches to try the Journal in
// its own colours or a bot's, light or dark, wide or in a narrow pane. Never shipped.
import type { Chip, ConfirmAsk, PluginEvent, PluginHost } from '../src/vendor/plugin-host/plugin-host.ts';
import { mount } from '../src/view/view.ts';

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
	const i = mode === 'light' ? 0 : 1;
	document.documentElement.dataset.mode = mode;
	pane.dataset.width = width;
	// Always given, as nclite gives them whichever colours the plugin wears: the mode and the faces.
	pane.style.setProperty('--host-color-scheme', mode);
	pane.style.setProperty('--host-font', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif");
	pane.style.setProperty('--host-font-mono', "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace");
	for (const p of COLOUR_PROPS) pane.style.removeProperty(p);
	if (look !== 'bot') return;
	const a = ACCENTS[$<HTMLSelectElement>('select[name=accent]').value]!;
	for (const [p, pair] of Object.entries(GROUNDS)) pane.style.setProperty(p, pair[i]);
	const text = GROUNDS['--host-ink']![i];
	pane.style.setProperty('--host-accent', a.accent[i]);
	// nclite's `--link`: in light, the accent mixed toward the text; in dark, the accent.
	pane.style.setProperty('--host-accent-strong', i === 0 ? `color-mix(in srgb, ${a.accent[0]} 65%, ${text})` : a.accent[1]);
	pane.style.setProperty('--host-accent-fill', a.strong[i]);
	pane.style.setProperty('--host-accent-fill-hover', `color-mix(in srgb, ${a.strong[i]} 88%, black)`);
}

// Remembered on this page only, so a reload keeps what was being looked at.
const SAVED = 'journal-dev-switches';
try {
	const saved = JSON.parse(localStorage.getItem(SAVED) ?? '{}') as Record<string, string>;
	for (const [name, value] of Object.entries(saved)) {
		const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name=${name}][value="${value}"], select[name=${name}]`);
		if (el instanceof HTMLInputElement) el.checked = true;
		else if (el instanceof HTMLSelectElement) el.value = value;
	}
} catch { /* a page with no storage starts on the defaults */ }
$('.dev-bar').addEventListener('change', () => {
	const form = Object.fromEntries(['look', 'mode', 'width', 'accent'].map((n) => [n,
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

const PREFIX = 'journal-dev-store:';
const chip = (c: Chip) => `${c.label}${c.detail ? ` (${c.detail})` : ''}`;
const host: PluginHost = {
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
	store: {
		get(key) {
			try { return localStorage.getItem(PREFIX + key); } catch { return null; }
		},
		set(key, value) {
			try { localStorage.setItem(PREFIX + key, value); } catch { /* it may lose anything */ }
		},
	},
	imageRoute: '/api/journal-images/',
};

// The view, on `window.journal` for the console: `journal.pageChip()`, `journal.reveal({ date })`, `journal.leave()`.
Object.assign(window, { journal: mount(root, host) });
