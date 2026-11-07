// The words (docs/specification/plugin.md § Words): `words/words.json` is the one home of every sentence the person or the
// bot reads. Read from the source as text: the keys the code names, the literals it holds, and the placeholders it fills.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { plan } from '../src/store/index.ts';
import { WORDS } from '../words/words.ts';
import { scratch } from './fixtures/days.ts';

const ROOT = path.join(import.meta.dirname, '..');
const words = WORDS as Record<string, string>;

/** Every source file whose words this test holds: `src/` but the vendored copies, and the words module itself. */
const SOURCES = [
	...(fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }) as string[])
		.filter((f) => f.endsWith('.ts') && !f.startsWith(`vendor${path.sep}`)).map((f) => path.join('src', f)),
	'words/words.ts',
].sort();

/** A file's code with its comments taken out (a `//` inside a string is kept). */
const code = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '')
	.replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const ALL = SOURCES.map((file) => ({ file, text: code(file) }));
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

describe('the words', () => {
	it('every key the code names is in words.json, and every key in it is named', () => {
		const named = new Set<string>();
		const prefixes = new Set<string>();
		for (const { text } of ALL) {
			for (const m of text.matchAll(/['"`](journal\.[\w.-]*[\w-])['"`]/g)) named.add(m[1]!);
			for (const m of text.matchAll(/`(journal\.[\w.-]*)\$\{/g)) prefixes.add(m[1]!);
		}
		assert.deepEqual([...named].filter((k) => !Object.hasOwn(words, k)), [], 'named in code, missing from words.json');
		const unnamed = Object.keys(words).filter((k) => !named.has(k) && ![...prefixes].some((p) => k.startsWith(p)));
		assert.deepEqual(unnamed, [], 'in words.json, named nowhere');
		for (const k of Object.keys(words)) assert.match(k, /^journal\.[a-z]+(\.[\w-]+)*$/, k);
	});

	it('no string literal in src/ is a sentence', () => {
		// A literal of four words or more is a sentence, unless it goes to the engine's log (`warn`) or is an internal error's
		// message: neither is read by the person or the bot.
		const found: string[] = [];
		for (const { file, text } of ALL.filter((f) => f.file !== 'words/words.ts')) {
			for (const m of text.matchAll(LITERAL)) {
				const literal = m[1] ?? m[2] ?? m[3] ?? '';
				const before = text.slice(Math.max(0, m.index - 12), m.index);
				if (/(warn|Error)\(\s*$/.test(before)) continue;
				if (/[A-Za-z’']+[ ,]+[A-Za-z’']+\s+[A-Za-z’']+\s+[A-Za-z’']+/.test(literal)) found.push(`${file}: ${literal.slice(0, 80)}`);
			}
		}
		assert.deepEqual(found, []);
	});

	it('every placeholder a sentence holds is filled where it is used', () => {
		// Each `word(key, { … })` and `say(key, { … })` with a literal key: every `{name}` of its sentence is a key of the
		// object, which is written out where it is used (one with a spread or built elsewhere is held by the tools' and the
		// view's own tests, which check every refusal and label for a placeholder left unfilled).
		const unfilled: string[] = [];
		let calls = 0;
		for (const { file, text } of ALL) {
			for (const m of text.matchAll(/\b(?:word|say)\(\s*'(journal\.[\w.-]+)'\s*(?:,\s*(\{[^}]*\}|[^)]*))?\)/g)) {
				const [, key, vars = ''] = m;
				if (vars.includes('...') || (vars !== '' && !vars.startsWith('{'))) continue;
				calls += 1;
				const given = new Set([...vars.matchAll(/(?:^|[{,])\s*([A-Za-z_]\w*)\s*(?=[:,}])/g)].map((g) => g[1]!));
				for (const name of placeholders(words[key!] ?? '')) if (!given.has(name)) unfilled.push(`${file}: ${key} {${name}}`);
			}
		}
		assert.ok(calls > 20, `the scan found the calls (${calls})`);
		assert.deepEqual(unfilled, []);
	});

	it('a refusal says what the code does, and the fix that works', async (t) => {
		// An entry's title is optional (the planner takes one with none), so the sentence for a bad time must not ask for one.
		assert.equal(plan('2026-11-07', null, { op: 'entry', date: '2026-11-07', time: '21:30', title: null, text: '' }).ok, true);
		assert.match(words['journal.problem.entry-time']!, /optional/);
		// A backwards range is refused `dates`: reading a shorter range would not fix it.
		const { dir, done } = scratch(true);
		t.after(done);
		const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
		const ctx = { caller: { by: 'agent' as const, agent: 'bot-0123456789abcdef' }, signal: new AbortController().signal };
		const r = await engine.tools.call('read_days', { from: '2026-11-07', to: '2026-11-01' }, ctx);
		assert.deepEqual(r.structuredContent, { refused: 'dates' });
		for (const text of [r.content[0]!.text, words['journal.problem.dates-range']!]) {
			assert.doesNotMatch(text, /shorter/, text);
			assert.match(text, /forwards/, text);
		}
	});
});
