// The Journal's chips: a block's Add to chat goes to the host's `chat.add`, and `pageChip()` never offers more than the
// engine's `resolve` takes (spec § The view, `pageChip()`; contract `CHIP_LIMITS`).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays, CHIP_DAYS, CHIP_TEXT_CHARS } from '../../src/format/index.ts';
import { CHIP_LIMITS, type Chip } from '../../src/vendor/plugin-host/plugin-host.ts';
import { dayMonth, shortDate, snippet } from '../../src/view/dates.ts';
import { say } from '../../src/view/words.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, thisWeek } from './fake-host.ts';

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;

/** Every bound of the contract a chip must keep. */
function assertInLimits(chip: Chip): void {
	assert.ok(chip.kind.length <= CHIP_LIMITS.kindChars);
	assert.ok(chip.label.length <= CHIP_LIMITS.labelChars, chip.label);
	assert.ok(chip.detail.length <= CHIP_LIMITS.detailChars);
	assert.ok(JSON.stringify(chip.ref).length <= CHIP_LIMITS.refChars);
}

/** Moves the range's end to `to`, as the person does with the To field. */
async function rangeTo(root: HTMLElement, to: string): Promise<void> {
	const field = q(root, '[data-range="to"]');
	field.value = to;
	fire(field, 'change');
	await settle();
}

describe('chips', () => {
	before(() => installDom());

	it('a block’s Add to chat calls chat.add with a chip inside CHIP_LIMITS', async () => {
		const { from } = thisWeek();
		const words = 'Walked to the river and back. '.repeat(6).trim();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 21:30 · Walk', words)));
		const block = q(m.root, '.block[data-kind="paragraph"]');
		fire(block, 'click');
		fire(q(m.root, '[data-act="ask"]'), 'click');
		assert.equal(m.calls.chips.length, 1);
		const chip = m.calls.chips[0]!;
		assert.deepEqual(chip, {
			plugin: 'journal',
			kind: 'block',
			ref: { date: from, key: block.getAttribute('data-key') },
			label: `${shortDate(from)} · 21:30 · Walk`,
			detail: snippet(words),
		});
		assertInLimits(chip);
		assert.deepEqual(m.calls.attached, [], 'nothing is staged by attach');
		m.view.unmount();
	});

	it('a block under a very long title still makes a chip inside the limits', async () => {
		const { from } = thisWeek();
		const m = await mounted((h) => h.files.set(from, fileOf(from, `## 07:00 · ${'Long '.repeat(80).trim()}`, 'Words.')));
		fire(q(m.root, '.block[data-kind="paragraph"]'), 'click');
		fire(q(m.root, '[data-act="ask"]'), 'click');
		assertInLimits(m.calls.chips[0]!);
		m.view.unmount();
	});

	it('writing not yet saved cannot go to the chat, and the view says so', async () => {
		const m = await mounted();
		fire(q(m.root, '.add-entry'), 'click');
		fire(q(m.root, '[data-act="ask"]'), 'click');
		assert.deepEqual(m.calls.chips, []);
		assert.deepEqual(m.calls.notes, [[say('journal.view.chip.unsaved'), 'info']]);
		m.view.unmount();
	});

	it('pageChip is the days shown', async () => {
		const m = await mounted();
		const week = thisWeek();
		const chip = m.view.pageChip()!;
		assert.deepEqual(chip, {
			plugin: 'journal',
			kind: 'days',
			ref: week,
			label: `${dayMonth(week.from)} – ${dayMonth(week.to)}`,
			detail: say('journal.view.chip.days', { count: 7 }),
		});
		assertInLimits(chip);
		m.view.unmount();
	});

	it('pageChip is null for a range longer than CHIP_DAYS', async () => {
		const m = await mounted();
		const { from } = thisWeek();
		await rangeTo(m.root, addDays(from, CHIP_DAYS));
		assert.equal(m.root.querySelectorAll('.day').length, CHIP_DAYS + 1);
		assert.equal(m.view.pageChip(), null);
		await rangeTo(m.root, addDays(from, CHIP_DAYS - 1));
		assert.deepEqual(m.view.pageChip()?.ref, { from, to: addDays(from, CHIP_DAYS - 1) });
		m.view.unmount();
	});

	it('pageChip is null for days holding more than CHIP_TEXT_CHARS', async () => {
		const { from } = thisWeek();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'x'.repeat(CHIP_TEXT_CHARS))));
		assert.equal(m.view.pageChip(), null);
		m.view.unmount();
		const under = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'x'.repeat(CHIP_TEXT_CHARS / 2))));
		assert.notEqual(under.view.pageChip(), null);
		under.view.unmount();
	});

	it('pageChip is null when a day shown is too big to read', async () => {
		const { from } = thisWeek();
		const m = await mounted((h) => {
			h.files.set(from, '');
			h.problems.set(from, ['This page is too big to show.']);
		});
		assert.equal(m.view.pageChip(), null);
		m.view.unmount();
	});
});
