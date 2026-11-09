// The focus ring shows only for Tab (GM, 2026-11-09; src/view/focus.ts): focus a pointer press gave is marked, and the
// stylesheet draws no ring on it, so a modifier pressed afterwards lights nothing; focus Tab gave is never marked; writing
// is never marked; and the mark only ever turns the ring off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { trackFocusSource } from '../../src/view/focus.ts';
import { withoutComments } from './css.ts';
import { FakeEvent, fire, installDom, newRoot, type FakeElement } from './fake-dom.ts';

const CSS = withoutComments(fs.readFileSync(path.join(import.meta.dirname, '../../src/view/journal.css'), 'utf8'));
const focusIn = (target: FakeElement) => target.dispatchEvent(new FakeEvent('focusin', { relatedTarget: null }));

describe('the focus ring', () => {
	before(() => installDom());

	it('marks what a pointer press focused, and not what Tab focused, whatever key came between', () => {
		const root = newRoot() as unknown as FakeElement;
		const button = document.createElement('button') as unknown as FakeElement;
		const other = document.createElement('button') as unknown as FakeElement;
		root.append(button, other);
		const stop = trackFocusSource(root as unknown as HTMLElement);
		fire(button, 'pointerdown');
		focusIn(button);
		assert.ok(button.hasAttribute('data-pointer-focus'));
		fire(document, 'keydown', { key: 'Shift' });
		assert.ok(button.hasAttribute('data-pointer-focus'), 'a modifier changes nothing');
		fire(button, 'focusout');
		fire(document, 'keydown', { key: 'Tab' });
		focusIn(other);
		assert.ok(!other.hasAttribute('data-pointer-focus'), 'Tab shows the ring');
		stop();
		assert.equal(root.listenerCount() + (document as unknown as FakeElement).listenerCount(), 0);
	});

	it('never marks writing, where the ring says where typing goes', () => {
		const root = newRoot() as unknown as FakeElement;
		const writing = document.createElement('div') as unknown as FakeElement;
		writing.setAttribute('contenteditable', 'true');
		root.append(writing);
		const stop = trackFocusSource(root as unknown as HTMLElement);
		fire(writing, 'pointerdown');
		focusIn(writing);
		assert.ok(!writing.hasAttribute('data-pointer-focus'));
		stop();
	});

	it('every focus-visible ring reads --journal-ring, which the mark sets to nothing', () => {
		const rings = CSS.split('\n').filter((l) => l.includes(':focus-visible') && /outline|box-shadow/.test(l));
		assert.ok(rings.length > 0);
		for (const line of rings) assert.ok(!line.includes('var(--journal-focus)'), line.trim());
		assert.match(CSS, /\[data-pointer-focus\]\s*\{\s*--journal-ring:\s*transparent;\s*\}/);
		assert.match(CSS, /--journal-ring:\s*var\(--journal-focus\);/);
	});
});
