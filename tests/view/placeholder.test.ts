// The prompt ("Write…", "Title") shows only while its writing holds no text (GM, 2026-11-09: after a backspace joined two
// lines, the browser left a stray break and "Write…" showed beside the words). `markBlank`, src/view/editor.ts.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { markBlank } from '../../src/view/editor.ts';
import { installDom, type FakeElement } from './fake-dom.ts';

const el = (tag: string, ...children: (FakeElement | string)[]) => {
	const e = document.createElement(tag) as unknown as FakeElement;
	e.append(...children);
	return e;
};
const line = (...children: (FakeElement | string)[]) => {
	const p = el('p', ...children);
	p.setAttribute('data-placeholder', 'Write…');
	return p;
};

describe('the writing prompt', () => {
	before(() => installDom());

	it('shows on the first line while the writing is empty, and on no line once it holds text, a stray break or not', () => {
		const first = line(el('br'));
		const body = el('div', first);
		markBlank(body as unknown as HTMLElement);
		assert.ok(first.hasAttribute('data-blank'), 'empty: the prompt shows');
		first.replaceChildren('Every day they would walk up the hill', el('br'));
		markBlank(body as unknown as HTMLElement);
		assert.ok(!first.hasAttribute('data-blank'), 'words and a stray break: no prompt');
		const second = line(el('br'));
		body.append(second);
		first.replaceChildren(el('br'));
		second.replaceChildren(el('br'));
		markBlank(body as unknown as HTMLElement);
		assert.ok(first.hasAttribute('data-blank') && !second.hasAttribute('data-blank'), 'only the first line ever prompts');
	});

	it('a title prompts while it is empty', () => {
		const title = el('span', el('br'));
		title.setAttribute('data-placeholder', 'Title');
		markBlank(title as unknown as HTMLElement);
		assert.ok(title.hasAttribute('data-blank'));
		title.replaceChildren('Three little piggies');
		markBlank(title as unknown as HTMLElement);
		assert.ok(!title.hasAttribute('data-blank'));
	});
});
