// The DOM-to-tree reader on a fake DOM: a block nobody touched reads back as exactly the tree it was drawn from, and
// what a browser leaves behind (a <b>, a no-break space, a trailing <br>) is tidied into what the parser gives.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installDom } from './fake-dom.ts';
import { blocksMarkdown, parseMarkdown } from '../../src/vendor/markdown/index.ts';
import { readBlocks, readInlines, same } from '../../src/view/dom-tree.ts';
import { bodyMarkdown } from '../../src/view/editor.ts';
import { el, renderMarkdown } from '../../src/view/render.ts';
import { headingMarkdown } from '../../src/view/specs.ts';
import { MARKER_RE, pasteChunks } from '../../src/view/editor-keys.ts';

/** The body of a journal entry: what a block element holds. */
const SAMPLES = [
	'A plain paragraph.',
	'Some **bold**, some *italic*, some ~~struck~~ and `code`.',
	'A [link](https://example.com/page) and an address https://example.com in text.',
	'An image ![a cat](https://example.com/cat.png) inline.',
	'A line\\\nbroken in two.',
	'- one\n- two\n- three',
	'1. first\n2. second',
	'3. starts at three\n4. four',
	'- [ ] to do\n- [x] done',
	'> A quote\n> over two lines.',
	'snake_case and 3.5 and a lone # stay as typed.',
];

const blockOf = (md: string) => el('div', renderMarkdown(md));

describe('reading the page back as the parser tree', () => {
	before(() => installDom());

	for (const md of SAMPLES) {
		it(`a drawn block reads back as its own tree: ${JSON.stringify(md.slice(0, 32))}`, () => {
			const tree = readBlocks(blockOf(md));
			assert.ok(same(tree, parseMarkdown(md)), JSON.stringify(tree));
		});
	}

	it('an untouched block saves as Markdown that parses to the same tree', () => {
		for (const md of SAMPLES) {
			const r = bodyMarkdown(blockOf(md));
			assert.ok('md' in r, md);
			assert.ok(same(parseMarkdown(r.md), parseMarkdown(md)), md);
		}
	});

	it('the browser’s own marks read as the parser’s, with spaces moved outside them', () => {
		const p = el('p', ['Say ', el('b', ['loud ']), 'words']);
		assert.deepEqual(readInlines(p), [
			{ kind: 'text', text: 'Say ' }, { kind: 'strong', children: [{ kind: 'text', text: 'loud' }] }, { kind: 'text', text: ' words' },
		]);
	});

	it('a no-break space reads as a space and a trailing break is dropped', () => {
		const p = el('p', ['two words', el('br')]);
		assert.deepEqual(readInlines(p), [{ kind: 'text', text: 'two words' }]);
	});

	it('an empty mark is dropped and loose text counts as a paragraph', () => {
		const root = el('div', ['loose ', el('em', []), 'text']);
		assert.deepEqual(readBlocks(root), [{ kind: 'paragraph', children: [{ kind: 'text', text: 'loose text' }] }]);
	});

	it('a ticked to-do reads as checked', () => {
		const root = blockOf('- [ ] to do');
		const box = root.querySelector('input') as unknown as { checked: boolean };
		box.checked = true;
		assert.equal(blocksMarkdown(readBlocks(root)), blocksMarkdown(parseMarkdown('- [x] to do')));
	});

	it('an empty block saves as nothing', () => {
		assert.deepEqual(bodyMarkdown(el('div', [el('p', [el('br')])])), { md: '' });
	});

	it('compares trees by structure, not key order', () => {
		assert.ok(same({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
		assert.ok(!same({ a: 1 }, { a: 1, b: undefined }));
		assert.ok(!same([1], { 0: 1 }));
	});
});

describe('entry headings', () => {
	before(() => installDom());

	it('pads a time and reads a title', () => {
		assert.deepEqual(headingMarkdown({ textContent: ' 9:05 ' }, null), { time: '09:05', title: null });
		assert.deepEqual(headingMarkdown({ textContent: '21:30' }, el('span', ['A ', el('i', ['quiet'])])), { time: '21:30', title: 'A *quiet*' });
	});

	it('refuses a time that is not one', () => {
		for (const t of ['24:00', '9:5', 'noon', '']) assert.ok('problem' in headingMarkdown({ textContent: t }, null), t);
	});

	it('an empty title is no title', () => {
		assert.deepEqual(headingMarkdown({ textContent: '07:00' }, el('span', [el('br')])), { time: '07:00', title: null });
	});
});

describe('typing helpers', () => {
	it('pastes text as paragraphs split on blank lines', () => {
		assert.deepEqual(pasteChunks('one\r\ntwo\n\n  three  \n\n\n'), ['one two', 'three']);
		assert.deepEqual(pasteChunks(' \n \n'), []);
	});

	it('knows the markers that make structure', () => {
		const kind = (t: string) => {
			const m = MARKER_RE.exec(t);
			return m === null ? null : m[1] ? 'todo' : m[2] ? 'list' : m[3] ? 'ordered' : 'quote';
		};
		assert.equal(kind('[] x'), 'todo');
		assert.equal(kind('- [ ] x'), 'todo');
		assert.equal(kind('- x'), 'list');
		assert.equal(kind('1. x'), 'ordered');
		assert.equal(kind('> x'), 'quote');
		assert.equal(kind('2. x'), null);
		assert.equal(kind('plain'), null);
	});
});
