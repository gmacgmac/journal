// The phone layout's touch targets and the entry column, held as rules of the stylesheet (screen review, FIX_01b): under
// the narrow container query every control of the range bar and the writing bar, and Add an entry / Start this page, is at
// least `--journal-tap` (44px) high, with the desktop layout untouched; and Add an entry starts its words where an
// entry's text starts, from the same measures the entries' grid uses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { withoutComments } from './css.ts';

const CSS = withoutComments(fs.readFileSync(path.join(import.meta.dirname, '../../src/view/journal.css'), 'utf8'));
const NARROW = '@container journal (max-width: 899px)';

/** The text inside the braces that open at `at`. */
function inside(css: string, at: number): string {
	const open = css.indexOf('{', at);
	let depth = 0;
	for (let i = open; i < css.length; i += 1) {
		if (css[i] === '{') depth += 1;
		else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
	}
	throw new Error('unclosed block');
}

/** Each rule of a block without nested blocks: its selectors and its declarations. */
function rules(block: string): { selectors: string[]; decls: Map<string, string> }[] {
	return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
		decls: new Map(m[2]!.split(';').map((d) => d.split(':')).filter((d) => d.length >= 2).map(([k, ...v]) => [k!.trim(), v.join(':').trim()])),
	}));
}

/** Every value `selector` is given `property` in `block`. */
const valuesOf = (block: string, selector: string, property: string) =>
	rules(block).filter((r) => r.selectors.includes(selector) && r.decls.has(property)).map((r) => r.decls.get(property)!);

const narrow = inside(CSS, CSS.indexOf(NARROW));
const wide = CSS.replace(narrow, '');
const TAP = 'var(--journal-tap)';
const CONTROLS = ['.range button', '.range input', '.bar button', '.bar-link input', '.add-entry', '.gap-add', '.feed-more'];

describe('the phone layout', () => {
	it('every control of the range bar and the writing bar, and Add an entry, is at least --journal-tap high', () => {
		assert.ok(CSS.indexOf(NARROW) >= 0, 'the narrow layout is a container query');
		assert.match(CSS, /--journal-tap:\s*44px;/);
		for (const selector of CONTROLS) assert.ok(valuesOf(narrow, selector, 'min-height').includes(TAP), `${selector} min-height`);
		assert.ok(valuesOf(narrow, '.bar button', 'min-width').includes(TAP), 'the writing bar’s one-letter buttons are as wide');
		assert.equal(wide.includes(TAP), false, 'the desktop layout does not move');
	});

	it('Add an entry starts its words where an entry’s text starts, on both layouts', () => {
		// The entries' grid and Add an entry read the same two measures; the narrow layout changes only the measures.
		const columns = [...valuesOf(wide, '.entries', 'grid-template-columns'), ...valuesOf(narrow, '.entries', 'grid-template-columns')];
		assert.ok(columns.length > 0 && columns.every((v) => v.startsWith('var(--journal-time-w) ')), columns.join(' | '));
		assert.deepEqual(valuesOf(narrow, '.entries', 'column-gap'), [], 'the phone changes the gutter by its measure only');
		assert.deepEqual(valuesOf(wide, '.entries', 'column-gap'), ['var(--journal-gutter)']);
		const margin = valuesOf(wide, '.add-entry', 'margin')[0] ?? '';
		const padding = valuesOf(wide, '.add-entry', 'padding')[0] ?? '';
		const inset = /^\S+ (\S+)$/.exec(padding)?.[1];
		assert.ok(inset !== undefined, `padding ${padding}`);
		assert.match(margin, new RegExp(`calc\\(var\\(--journal-time-w\\) \\+ var\\(--journal-gutter\\) - ${inset}\\)`), 'the words, not the button’s edge, meet the column');
		assert.ok(rules(narrow).some((r) => r.decls.has('--journal-time-w') && r.decls.has('--journal-gutter')), 'the phone sets the measures');
	});
});
