// The manifest (docs/specification/plugin.md § The manifest): its tools are the engine's own list, and every words key it
// names is in words.json.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { READ_MAX_CHARS, READ_MAX_DAYS } from '../src/engine/tools/index.ts';
import { CHANGE_WORDS, PLUGIN_ID, manifestOf } from '../src/manifest.ts';
import { WORDS } from '../words/words.ts';
import { scratch } from './fixtures/days.ts';

const manifest = manifestOf('0.0.0');
const words = WORDS as Record<string, string>;

describe('the manifest', () => {
	it('the manifest\'s tools are exactly tools.list(): names, schemas and words', (t) => {
		const { dir, done } = scratch(true);
		t.after(done);
		const listed = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} }).tools.list();
		assert.deepEqual(manifest.tools.map((d) => d.name), listed.map((l) => l.name));
		for (const [i, d] of manifest.tools.entries()) {
			const l = listed[i]!;
			assert.deepEqual(d.input, l.inputSchema, d.name);
			assert.equal(words[d.words], l.description, d.name);
			assert.equal(d.writes, l.annotations?.readOnlyHint === false, d.name);
			assert.equal(d.words, `${PLUGIN_ID}.tool.${d.name}`);
		}
	});

	it('every words key the manifest names is in words.json', () => {
		const keys = [manifest.name, ...manifest.chips.map((c) => c.words), ...manifest.tools.map((d) => d.words), ...(manifest.changeWords ?? [])];
		assert.deepEqual(keys.filter((k) => !Object.hasOwn(words, k)), []);
		// A tool's description is shown as written, so it holds no placeholder; the limits it states are the code's.
		for (const d of manifest.tools) assert.ok(!/\{\w+\}/.test(words[d.words]!), d.name);
		assert.ok(words['journal.tool.read_days']!.includes(`${READ_MAX_DAYS} days and ${READ_MAX_CHARS} characters`));
	});

	it('every changeWords key starts journal. and is used by a tool', () => {
		// "Used by a tool" is proven by running each write: tests/tools.test.ts "a write's _meta is the contract's change line".
		assert.deepEqual(manifest.changeWords, CHANGE_WORDS);
		for (const k of CHANGE_WORDS) assert.match(k, new RegExp(`^${PLUGIN_ID}\\.change\\.`));
		for (const k of CHANGE_WORDS) assert.match(words[k]!, /\{subject\}/, k);
	});
});
