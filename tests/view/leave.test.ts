// `unsaved()` and `leave()` (spec § The view): leave saves what is open, and asks through `confirm` only when that save
// is refused or slower than LEAVE_SAVE_MS, so it always answers, or asks, within the host's VIEW_ANSWER_MS.
import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { VIEW_ANSWER_MS } from '../../src/vendor/plugin-host/plugin-host.ts';
import { LEAVE_SAVE_MS } from '../../src/view/leave.ts';
import { say } from '../../src/view/words.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, recent } from './fake-host.ts';

const refusal = (title: string) => new Response(JSON.stringify({ title, status: 422, code: 'rules' }), { status: 422 });

/** A journal with one paragraph open for writing and changed. */
async function writing() {
	const { from } = recent();
	const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
	const block = m.root.querySelector('.block[data-kind="paragraph"]') as unknown as FakeElement;
	fire(block, 'click');
	block.querySelector('p')!.replaceChildren('Morning, changed.');
	return { ...m, block, from };
}

describe('leave', () => {
	before(() => installDom());

	it('waits half the host’s wait for its save', () => {
		assert.equal(LEAVE_SAVE_MS, VIEW_ANSWER_MS / 2);
	});

	it('nothing open, or open and unchanged: nothing unsaved, and leave answers true at once', async () => {
		const m = await mounted((h) => h.files.set(recent().from, fileOf(recent().from, '## 08:00', 'Morning.')));
		assert.equal(m.view.unsaved(), false);
		assert.equal(await m.view.leave(), true);
		fire(m.root.querySelector('.block[data-kind="paragraph"]'), 'click');
		assert.ok(m.root.querySelector('.editing') !== null);
		assert.equal(m.view.unsaved(), false);
		assert.equal(await m.view.leave(), true);
		assert.deepEqual(m.calls.edits, []);
		m.view.unmount();
	});

	it('leave saves, and asks nothing when the save lands', async () => {
		const m = await writing();
		assert.equal(m.view.unsaved(), true);
		assert.equal(await m.view.leave(), true);
		assert.equal(m.calls.edits.length, 1);
		assert.match(m.files.get(m.from)!, /Morning, changed\./);
		assert.deepEqual(m.calls.asks, []);
		assert.equal(m.view.unsaved(), false);
		m.view.unmount();
	});

	it('a refused save asks through confirm: keep writing answers false and the words stay', async () => {
		const m = await writing();
		m.knobs.edit = () => refusal('Refused for the test.');
		assert.equal(await m.view.leave(), false);
		assert.deepEqual(m.calls.asks, [{
			heading: say('journal.view.leave.heading'), body: 'Refused for the test.', confirm: say('journal.view.leave.confirm'),
		}]);
		assert.equal(m.view.unsaved(), true);
		assert.equal(m.block.querySelector('p')!.textContent, 'Morning, changed.');
		m.view.unmount();
	});

	it('a refused save asks through confirm: discard answers true and puts the block back', async () => {
		const m = await writing();
		m.knobs.edit = () => refusal('Refused for the test.');
		m.knobs.confirm = async () => true;
		assert.equal(await m.view.leave(), true);
		assert.equal(m.view.unsaved(), false);
		assert.equal(m.root.querySelector('.editing'), null);
		assert.equal(m.block.querySelector('p')!.textContent, 'Morning.');
		m.view.unmount();
	});

	it('a save slower than LEAVE_SAVE_MS asks, inside the host’s wait; a second call gets the same answer', async () => {
		mock.timers.enable({ apis: ['setTimeout'] });
		try {
			const m = await writing();
			m.knobs.edit = () => null;
			let answer!: (yes: boolean) => void;
			m.knobs.confirm = () => new Promise((done) => (answer = done));
			const first = m.view.leave();
			const second = m.view.leave();
			assert.equal(first, second);
			await settle();
			assert.equal(m.calls.asks.length, 0);
			mock.timers.tick(LEAVE_SAVE_MS);
			await settle();
			assert.equal(m.calls.asks.length, 1);
			assert.equal(m.calls.asks[0]!.body, say('journal.view.leave.slow'));
			answer(true);
			assert.equal(await first, true);
			assert.equal(m.calls.edits.length, 1, 'the save was sent once');
			m.view.unmount();
		} finally {
			mock.timers.reset();
		}
	});

	it('once the host closed it anyway, a late answer acts on nothing', async () => {
		const m = await writing();
		m.knobs.edit = () => refusal('Refused for the test.');
		let answer!: (yes: boolean) => void;
		m.knobs.confirm = () => new Promise((done) => (answer = done));
		const pending = m.view.leave();
		await settle();
		assert.equal(m.calls.asks.length, 1);
		const notes = m.calls.notes.length;
		m.view.unmount();
		answer(false);
		assert.equal(await pending, false);
		await settle();
		assert.equal(m.root.childNodes.length, 0);
		assert.equal(m.calls.notes.length, notes, 'nothing said after unmount');
	});
});
