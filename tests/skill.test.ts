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
	});

	// nclite lists a plugin's skill by its front matter and opens the rest when the bot needs it (progressive disclosure,
	// GM 2026-11-07): `name` is the plugin's id, `description` one line that says when to read it.
	it('the skill opens with front matter naming the plugin and saying when to read it', () => {
		const m = /^---\nname: (.+)\ndescription: (.+)\n---\n\n# /.exec(skill);
		assert.ok(m, 'front matter with name and description, then the title');
		assert.equal(m[1], manifestOf('0.0.0').id);
		assert.ok(m[2]!.length <= 1000, `${m[2]!.length} characters`);
		assert.match(m[2]!, /^The person's journal.*Read this before/);
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
	// Real turns on Haiku 5.5 (nclite, 2026-11-07): asked to add a to-do, the bot once used insert_after, which leaves a
	// second one-item list under the first. The skill and the tool's words send a list item to replace_block instead.
	it('an item added with insert_after after a list is a block of its own, so the skill and the tool send list items to replace_block', async (t) => {
		const { dir, done } = scratch(true);
		t.after(done);
		const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
		const ctx = { caller: { by: 'agent' as const, agent: 'bot-0123456789abcdef' }, signal: new AbortController().signal };
		await engine.tools.call('add_entry', { date: '2026-11-07', time: '09:00', text: '- [ ] One\n- [ ] Two', version: null }, ctx);
		const day = async () => ((await engine.tools.call('read_days', { from: '2026-11-07' }, ctx)).structuredContent as { days: { version: string; text: string }[] }).days[0]!;
		const { version } = await day();
		await engine.tools.call('insert_after', { date: '2026-11-07', version, entry: '09:00', block: '- [ ] One\n- [ ] Two', text: '- [ ] Three' }, ctx);
		const page = (await day()).text;
		assert.ok(page.includes('- [ ] Two\n\n- [ ] Three'), 'a block of its own');
		const bullet = skill.slice(skill.indexOf('- `insert_after`')).split(/\n- |\n\n/)[0]!;
		assert.match(bullet, /list.*`replace_block`/s);
		assert.match(WORDS['journal.tool.insert_after']!, /list.*replace_block/s);
	});
	// The same run: told "the engineer is coming on Tuesday", the bot once wrote the note on Tuesday's page.
	it('the skill says a note goes on today\'s page unless the person names the page', () => {
		const bullet = skill.slice(skill.indexOf('- `add_entry`')).split(/\n- |\n\n/)[0]!;
		assert.match(bullet, /today/);
	});
});
