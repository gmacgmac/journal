// THE JOURNAL'S COLOURS (spec § The look): the paper's tokens read only the contract's host properties, and every pair the
// page draws meets its APCA tier, light and dark, both with a host's values and with none (the proof's own paper).
// The tokens are read from the stylesheet itself, so this holds the CSS, never a copy of it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { HOST_PROPERTIES } from '../../src/vendor/plugin-host/plugin-host.ts';
import { apcaLc, declared, evaluate, hex, type Host, type Mode } from './colour-math.ts';
import { topLevel, withoutComments } from './css.ts';

const CSS = withoutComments(fs.readFileSync(path.join(import.meta.dirname, '../../src/view/journal.css'), 'utf8'));
const TOKENS = declared(CSS, '.journal');

/**
 * A host's values: nclite's table, which is the board spec's § Theme and host styling (its values light / dark, the ones a
 * host promises to keep its own pairs with). An input, so it is written here.
 */
const HOST: Host = {
	'--host-accent': { light: '#d4138a', dark: '#ff5cbe' },
	'--host-accent-strong': { light: '#c81784', dark: '#ff66c2' },
	'--host-accent-fill': { light: '#d4138a', dark: '#ff85cf' },
	'--host-accent-fill-hover': { light: '#bc0f7a', dark: '#ff9bd8' },
	'--host-on-accent': { light: '#ffffff', dark: '#1a0712' },
	'--host-canvas': { light: '#f5f5f6', dark: '#111112' },
	'--host-surface': { light: '#ffffff', dark: '#1a1a1c' },
	'--host-surface-sunken': { light: '#efeff1', dark: '#222225' },
	'--host-ink': { light: '#18181b', dark: '#ededef' },
	'--host-ink-muted': { light: '#6b6b74', dark: '#b8b8c0' },
	'--host-line': { light: '#e1e1e5', dark: '#2a2a2e' },
	'--host-line-strong': { light: '#cbcbd1', dark: '#3a3a40' },
};

/** Each pair the page draws, text on ground, and the tier it keeps: the spec's, and the bar's, toast's and range bar's. */
const PAIRS: [text: string, grounds: string[], lc: number][] = [
	...['--journal-ink', '--journal-ink-soft'].map((ink): [string, string[], number] =>
		[ink, ['--journal-desk', '--journal-page', '--journal-field', '--journal-hover', '--journal-fresh'], 60]),
	['--journal-date-ink', ['--journal-page'], 45],
	['--journal-link', ['--journal-page', '--journal-field', '--journal-hover', '--journal-fresh'], 45],
	['--journal-on-fill', ['--journal-fill', '--journal-fill-hover'], 60],
	['--journal-page', ['--journal-ink'], 60],
	['--journal-app-ink', ['--journal-app-bg', '--journal-app-field'], 60],
	['--journal-app-accent', ['--journal-app-field', '--journal-app-raised'], 45],
	['--journal-focus', ['--journal-page', '--journal-field'], 30],
];

const HOSTS: [string, Host][] = [['with the host’s values', HOST], ['without them', {}]];

describe('the Journal’s colours', () => {
	it('measures APCA as APCA-W3 does: black on white and white on black', () => {
		assert.equal(apcaLc(hex('#000'), hex('#fff')).toFixed(2), '106.04');
		assert.equal(apcaLc(hex('#fff'), hex('#000')).toFixed(2), '-107.88');
	});

	it('without the host, the paper is the proof’s own, exactly', () => {
		const own: [string, string][] = [
			['--journal-desk', 'light-dark(#e6dccb, #13100f)'],
			['--journal-page', 'light-dark(#fbf6ec, #1c1916)'],
			['--journal-fresh', 'light-dark(#f3dfc1, #3b2d22)'],
		];
		for (const [token, value] of own) {
			for (const mode of ['light', 'dark'] as Mode[]) {
				assert.deepEqual(evaluate(`var(${token})`, TOKENS, {}, mode), evaluate(value, TOKENS, {}, mode), `${token} ${mode}`);
			}
		}
	});

	it('every pair meets its tier with the host’s values and without them, light and dark', () => {
		const short: string[] = [];
		for (const [label, host] of HOSTS) {
			for (const mode of ['light', 'dark'] as Mode[]) {
				for (const [text, grounds, lc] of PAIRS) {
					for (const ground of grounds) {
						const t = evaluate(`var(${text})`, TOKENS, host, mode);
						const g = evaluate(`var(${ground})`, TOKENS, host, mode);
						assert.ok(t !== null && g !== null, `${text} on ${ground} works out, ${label}, ${mode}`);
						const got = Math.abs(apcaLc(t, g));
						if (got < lc) short.push(`${label}, ${mode}: ${text} on ${ground} is Lc ${got.toFixed(1)}, under ${lc}`);
					}
				}
			}
		}
		assert.deepEqual(short, []);
	});

	it('the stylesheet reads only host properties of the contract’s list, and its own', () => {
		const reads = [...CSS.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!);
		const host = new Set<string>(HOST_PROPERTIES);
		const strangers = reads.filter((p) => !p.startsWith('--journal-') && !host.has(p));
		assert.deepEqual(strangers, []);
		const unset = reads.filter((p) => p.startsWith('--journal-') && !TOKENS.has(p) && p !== '--journal-bar-h');
		assert.deepEqual(unset, [], 'every own property it reads is one it declares (the bar height is set by the view)');
		const declaresHost = [...TOKENS.keys()].filter((p) => !p.startsWith('--journal-'));
		assert.deepEqual(declaresHost, [], 'it declares no host property');
	});

	it('every rule is under .journal', () => {
		for (const p of topLevel(CSS)) assert.match(p, /^(\.journal|@keyframes journal-[\w-]+)$/, p);
	});

	it('the mode is the host’s: its color-scheme, light and dark when the host gives none', () => {
		assert.match(CSS, /\.journal \{\s*color-scheme: var\(--host-color-scheme, light dark\);/);
		assert.doesNotMatch(CSS, /data-paper/);
	});
});
