// Backspace at the start of a paragraph joins it to the paragraph above (`bodySpec` `merge`): the view names the two blocks
// by the keys the person saw and sends the writing as one paragraph; the engine finds their bytes, however they are spaced.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { BlockNode } from '../../src/view/session.ts';
import { dateTitle } from '../../src/format/index.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, recent } from './fake-host.ts';

const paragraphs = (root: HTMLElement, date: string) =>
	[...root.querySelectorAll(`.day[data-date="${date}"] .block[data-kind="paragraph"]`)] as unknown as BlockNode[];

/** Opens the second paragraph and joins it to the first, as Backspace at its start does. */
function backspaceInto(root: HTMLElement, date: string): void {
	const [first, second] = paragraphs(root, date);
	fire(second as unknown as FakeElement, 'click');
	const s = second!._editor!;
	s.spec.merge!(s, first!);
}

describe('Backspace joins two paragraphs', () => {
	before(() => installDom());

	it('sends a join naming both blocks by key, with the writing as one paragraph', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'One.', 'Two.')));
		const [, , one, two] = m.dayOf(from).blocks;
		backspaceInto(m.root, from);
		await settle();
		assert.deepEqual(m.calls.edits, [{ op: 'join', date: from, first: one!.key, second: two!.key, text: 'One.Two.' }]);
		assert.equal(m.files.get(from), fileOf(from, '## 08:00', 'One.Two.'));
		m.view.unmount();
	});

	it('joins a pair spaced by hand: nothing is refused for the blank lines between them', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, `# ${dateTitle(from)}\n\n## 08:00\n\nOne.\n\n\n\nTwo.\n`));
		backspaceInto(m.root, from);
		await settle();
		assert.deepEqual(m.calls.notes, []);
		assert.equal(m.files.get(from), fileOf(from, '## 08:00', 'One.Two.'));
		m.view.unmount();
	});
});
