// The view's words (`src/view/words.ts`): every key is a `journal.view.*` key the view's code names, so the table holds
// nothing stale when it moves into `words/words.json`; the compiler holds the other way (a key the code names exists).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { say, viewWordKeys } from '../../src/view/words.ts';

const DIR = path.join(import.meta.dirname, '../../src/view');
const code = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'words.ts').map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');

describe('the view’s words', () => {
	it('every key is journal.view.* and named by the view’s code', () => {
		const unused = viewWordKeys().filter((k) => !code.includes(`'${k}'`));
		assert.deepEqual(unused, []);
		for (const k of viewWordKeys()) assert.match(k, /^journal\.view\.[a-z][\w.]*$/);
	});

	it('fills a placeholder and leaves an unknown one as it is', () => {
		assert.equal(say('journal.view.chip.days', { count: 9 }), say('journal.view.chip.days').replace('{count}', '9'));
		assert.ok(say('journal.view.chip.days').includes('{count}'));
	});
});
