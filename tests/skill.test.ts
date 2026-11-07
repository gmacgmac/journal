// The skill (docs/specification/plugin.md § The skill): within its budget, and true to the tools it names.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { READ_MAX_DAYS } from '../src/engine/tools/index.ts';
import { manifestOf } from '../src/manifest.ts';
import { SKILL_BYTES } from '../src/vendor/plugin-host/plugin-host.ts';

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
});
