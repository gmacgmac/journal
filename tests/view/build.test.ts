// The built view: one module exporting only `mount`, one stylesheet, and every rule of it under the plugin's own
// prefix: top-level rules are `.journal` or its keyframes, and every custom property it sets is `--journal-*`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { build } from 'vite';
import { viewBuild } from '../../vite.config.ts';
import { topLevel, withoutComments } from './css.ts';

/** Every selector or at-rule prelude in the sheet, at any depth: the text before each `{`. */
const preludes = (css: string) => [...css.matchAll(/([^{};]*)\{/g)].map((m) => m[1]!.trim());

describe('the built view', () => {
	let tmp: string;
	let css: string;
	let js: string;
	before(async () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-view-'));
		await build(viewBuild(tmp));
		css = withoutComments(fs.readFileSync(path.join(tmp, 'view/journal.css'), 'utf8'));
		js = fs.readFileSync(path.join(tmp, 'view/journal.js'), 'utf8');
	});
	after(() => fs.rmSync(tmp, { recursive: true, force: true }));

	it('is one module and one stylesheet', () => {
		assert.deepEqual(fs.readdirSync(path.join(tmp, 'view')).sort(), ['journal.css', 'journal.js']);
	});

	it('exports only mount', async () => {
		const mod = await import(`${path.join(tmp, 'view/journal.js')}?${Date.now()}`);
		assert.deepEqual(Object.keys(mod), ['mount']);
		assert.equal(typeof mod.mount, 'function');
	});

	it('puts every top-level rule under .journal, and its keyframes under its name', () => {
		const top = topLevel(css);
		assert.ok(top.length > 0);
		for (const p of top) assert.match(p, /^(\.journal|@keyframes journal-[\w-]+)$/, p);
	});

	it('sets only its own custom properties: the Journal’s, and the date-pick package’s tokens it sets for it', () => {
		const set = [...css.matchAll(/(?:^|[{;])\s*(--[\w-]+)\s*:/g)].map((m) => m[1]!);
		assert.ok(set.length > 0);
		for (const name of set) assert.match(name, /^--(journal|dp)-/, name);
	});

	it('imports nothing and fetches nothing', () => {
		assert.doesNotMatch(css, /@import|url\(/);
		assert.doesNotMatch(js, /\bfetch\(|XMLHttpRequest|EventSource|localStorage/);
	});

	it('names no fixed id: every id is made per mount', () => {
		const ids = preludes(css).filter((p) => p.includes('#'));
		assert.deepEqual(ids, []);
		assert.ok(!/\bid:\s*["'`][\w-]+["'`]/.test(js), 'the view names a fixed id');
	});
});
