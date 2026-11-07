// Days as elements, patched by key: what stays is the same element in the same place, so the page never jumps.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installDom } from './fake-dom.ts';
import type { Block, Day } from '../../src/view/wire.ts';
import { blockElement, daySection, patchDay } from '../../src/view/days.ts';
import type { BlockNode } from '../../src/view/session.ts';

const HINT = 'hint-a';

/** A day from its block texts, laid out the way the engine lays out a file: blocks a blank line apart. The first text
 *  is its date line, `# <title>`, as the engine's title and the file's first line always agree. */
function dayOf(date: string, texts: string[], problems: string[] = []): Day {
	let at = 0;
	const blocks: Block[] = texts.map((text) => {
		const b = { start: at, end: at + text.length, text, key: `k:${text}` };
		at = b.end + 2;
		return b;
	});
	return { date, title: texts[0]!.replace(/^# /, ''), exists: true, version: null, blocks, problems };
}

const keysOf = (section: Element) => [...section.querySelector('.entries')!.children].map((n) => (n as BlockNode).dataset.key);

describe('days as elements', () => {
	before(() => installDom());

	it('draws an entry heading with its time and title, and a body block with its kind', () => {
		const head = blockElement('2026-10-01', { start: 0, end: 20, text: '## 21:30 · Evening', key: 'h' }, HINT);
		assert.ok(head.classList.contains('entry-head') && head.classList.contains('has-title'));
		assert.equal(head.querySelector('.time')!.textContent, '21:30');
		assert.equal(head.querySelector('.title')!.textContent, 'Evening');
		const body = blockElement('2026-10-01', { start: 22, end: 30, text: '- a\n- b', key: 'b' }, HINT);
		assert.equal(body.dataset.kind, 'list');
		assert.equal(body._text, '- a\n- b');
		assert.equal(body.getAttribute('aria-describedby'), HINT);
	});

	it('draws a missing day as a gap with a way to start it', () => {
		const s = daySection({ date: '2026-10-03', title: 'Saturday', exists: false, version: null, blocks: [], problems: [] }, HINT);
		assert.ok(s.classList.contains('gap'));
		assert.equal(s.querySelector('.add-entry')!.textContent, 'Start this page');
	});

	it('a patch keeps unchanged blocks as the same elements and marks only new ones fresh', () => {
		const date = '2026-10-01';
		const first = dayOf(date, ['# Thursday 1 October 2026', '## 08:00', 'Morning.', 'Coffee.']);
		const section = daySection(first, HINT);
		const before = new Map([...section.querySelectorAll('.block')].map((n) => [(n as BlockNode).dataset.key, n]));
		const next = dayOf(date, ['# Thursday 1 October 2026', '## 08:00', 'Morning rewritten.', 'Coffee.']);
		const stats = patchDay(next, section, true, HINT);
		assert.deepEqual(stats, { date, kept: 2, added: 1, removed: 1, moved: 0 });
		assert.deepEqual(keysOf(section), next.blocks.slice(1).map((b) => b.key));
		assert.equal(section.querySelector('.block[data-key="k:Coffee."]'), before.get('k:Coffee.'));
		assert.equal((section.querySelector('.block[data-key="k:Coffee."]') as BlockNode).dataset.start, String(next.blocks[3]!.start));
		assert.ok(section.querySelector('.block[data-key="k:Morning rewritten."]')!.classList.contains('fresh'));
		assert.ok(!section.querySelector('.block[data-key="k:Coffee."]')!.classList.contains('fresh'));
	});

	it('the person’s own save is not marked fresh', () => {
		const date = '2026-10-01';
		const section = daySection(dayOf(date, ['# D', '## 08:00']), HINT);
		patchDay(dayOf(date, ['# D', '## 08:00', 'New.']), section, false, HINT);
		assert.ok(!section.querySelector('.block[data-key="k:New."]')!.classList.contains('fresh'));
	});

	it('a draft stays where it was put through a patch', () => {
		const date = '2026-10-01';
		const section = daySection(dayOf(date, ['# D', '## 08:00', 'One.']), HINT);
		const entries = section.querySelector('.entries')!;
		const draft = document.createElement('div');
		draft.className = 'block draft';
		entries.querySelector('.block[data-key="k:## 08:00"]')!.after(draft);
		patchDay(dayOf(date, ['# D', '## 08:00', 'One.', 'Two.']), section, true, HINT);
		const order = [...entries.children].map((n) => (n.classList.contains('draft') ? 'draft' : (n as BlockNode).dataset.key));
		assert.deepEqual(order, ['k:## 08:00', 'draft', 'k:One.', 'k:Two.']);
	});

	it('a day that comes into being replaces its gap', () => {
		const date = '2026-10-03';
		const page = document.createElement('article');
		const gap = daySection({ date, title: 'Saturday', exists: false, version: null, blocks: [], problems: [] }, HINT);
		page.append(gap);
		assert.deepEqual(patchDay(dayOf(date, ['# D', '## 09:00']), gap, true, HINT), { date, replacedDay: true });
		assert.ok(!page.querySelector('.day')!.classList.contains('gap'));
		assert.equal(patchDay(dayOf(date, ['# D']), null, true, HINT), null);
	});

	it('a day that breaks the rules is drawn as it is, read only, with its problems over it', () => {
		const date = '2026-10-01';
		const problems = ['The first line should be the date.'];
		const section = daySection(dayOf(date, ['## 08:00', '- [ ] water the plants'], problems), HINT);
		assert.ok(section.classList.contains('broken'));
		assert.deepEqual([...section.querySelector('.problems')!.querySelectorAll('li')].map((li) => li.textContent), problems);
		// Every block is drawn, the first too, since it is not the date line; none takes focus or ticks.
		assert.deepEqual(keysOf(section), ['k:## 08:00', 'k:- [ ] water the plants']);
		assert.ok([...section.querySelectorAll('.block')].every((n) => !n.hasAttribute('tabindex') && !n.hasAttribute('aria-describedby')));
		assert.equal((section.querySelector('input.todo') as HTMLInputElement).disabled, true);
		assert.equal(section.querySelector('.add-entry'), null);
	});

	it('a day that starts or stops breaking the rules is drawn anew', () => {
		const date = '2026-10-01';
		const page = document.createElement('article');
		const good = daySection(dayOf(date, ['# D', '## 08:00']), HINT);
		page.append(good);
		assert.deepEqual(patchDay(dayOf(date, ['# D', '## 8:00'], ['bad heading']), good, true, HINT), { date, replacedDay: true });
		const broken = page.querySelector('.day')!;
		assert.ok(broken.classList.contains('broken'));
		assert.deepEqual(patchDay(dayOf(date, ['# D', '## 08:00']), broken, true, HINT), { date, replacedDay: true });
		assert.ok(!page.querySelector('.day')!.classList.contains('broken'));
	});

	it('a day with no page, patched while it still has none, stays as it is', () => {
		const date = '2026-10-03';
		const gap = daySection({ date, title: 'Saturday', exists: false, version: null, blocks: [], problems: [] }, HINT);
		const none = { date, title: 'Saturday', exists: false, version: null, blocks: [], problems: [] };
		assert.deepEqual(patchDay(none, gap, true, HINT), { date, kept: 0, added: 0, removed: 0, moved: 0 });
		assert.ok(gap.classList.contains('gap'));
	});

	it('an empty day says nothing is written', () => {
		const section = daySection(dayOf('2026-10-01', ['# D']), HINT);
		assert.ok(section.classList.contains('blank'));
	});
});
