// The skill (docs/specification/plugin.md § The skill): within its budget, and true to the tools it names.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { READ_MAX_DAYS } from '../src/engine/tools/index.ts';
import { manifestOf } from '../src/manifest.ts';
import { SKILL_BYTES } from '../src/vendor/plugin-host/plugin-host.ts';
import { WORDS } from '../words/words.ts';
import { scratch } from './fixtures/days.ts';

const skill = fs.readFileSync(path.join(import.meta.dirname, '../skill/SKILL.md'), 'utf8');
const tools = manifestOf('0.0.0').tools.map((d) => d.name);

describe('the skill', () => {
	it('the skill is within SKILL_BYTES', () => {
		const bytes = Buffer.byteLength(skill, 'utf8');
		assert.ok(bytes <= SKILL_BYTES, `${bytes} bytes, budget ${SKILL_BYTES}`);
		assert.ok(skill.startsWith('# '), 'no front matter');
	});

	it('every tool the skill names is a tool of the manifest', () => {
		const named = new Set([...skill.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]!));
		assert.deepEqual([...named].filter((n) => !tools.includes(n)), []);
		assert.deepEqual(tools.filter((n) => !named.has(n)), [], 'and it names every tool');
		assert.ok(skill.includes(`at most ${READ_MAX_DAYS} days`), 'the read limit it states is the code\'s');
	});

	it('every refusal that sends the bot to the file is named where the skill says what to do when refused', () => {
		// The skill forbids writing the files, except where a refusal says to: each such refusal is listed there.
		const section = skill.slice(skill.indexOf('## When a change is refused'));
		const toFile = Object.entries(WORDS as Record<string, string>)
			.filter(([k, v]) => k.startsWith('journal.refusal.') && v.includes('.journal/{path}')).map(([k]) => k.slice('journal.refusal.'.length));
		assert.ok(toFile.includes('malformed'), `found ${toFile.join(', ')}`);
		assert.deepEqual(toFile.filter((code) => !section.includes(`\`${code}\``)), []);
	});

	it('the skill says what add_entry takes as the version of a day with no page', async (t) => {
		const { dir, done } = scratch(true);
		t.after(done);
		const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
		const ctx = { caller: { by: 'agent' as const, agent: 'bot-0123456789abcdef' }, signal: new AbortController().signal };
		const r = await engine.tools.call('add_entry', { date: '2026-11-07', time: '09:00', text: 'First.', version: null }, ctx);
		assert.equal(r.isError, false, 'null is the version of a day with no page');
		const bullet = skill.slice(skill.indexOf('- `add_entry`')).split(/\n- |\n\n/)[0]!;
		assert.match(bullet, /`null`/);
	});
});
