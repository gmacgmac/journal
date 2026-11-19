// What a session saves for a block already on the page (see `editor.ts`):
//   body     paragraphs, lists, to-dos and quotes, saved as a replace; Add title from here gives its entry a title
//   heading  an entry's time and title, edited in their own places: the time stays in the margin, so the box is
//            never squeezed into it; the time can be taken off (the title then holds the entry) or put back
import { entryHeading, entryOf } from '../format/index.ts';
import { inlineMarkdown } from '../vendor/markdown/index.ts';
import { readInlines } from './dom-tree.ts';
import { bodyMarkdown } from './editor.ts';
import { el, renderMarkdown } from './render.ts';
import { entryHeadOf, startOf, type BlockNode, type Session, type Spec } from './session.ts';
import type { Edit } from './wire.ts';
import { say } from './words.ts';

const range = (node: BlockNode) => ({ date: node.dataset.date!, start: Number(node.dataset.start), end: Number(node.dataset.end) });
const clones = (node: Node): Node[] => [...node.childNodes].map((c) => c.cloneNode(true));

export function bodySpec(node: BlockNode): Spec {
	const st = { before: node._text ?? '', shown: clones(node), removedAt: NaN };
	return {
		kind: 'body',
		editables: () => [node],
		read() {
			const r = bodyMarkdown(node);
			if ('problem' in r) return r;
			if (r.md === st.before) return { edit: null };
			// The only writing of an entry with no title, emptied: the entry goes, its time with it (GM, 2026-11-19).
			if (r.md === '') {
				const whole = emptiedEntry(node);
				if (whole !== null) {
					st.removedAt = Number(entryHeadOf(node)!.dataset.start);
					return { edit: whole };
				}
			}
			return { edit: { op: 'replace', ...range(node), before: st.before, after: r.md } };
		},
		restore: () => node.replaceChildren(...st.shown.map((c) => c.cloneNode(true))),
		// A removed entry names no place in the file: the cursor lands where its heading was.
		landing: ({ edit }) => (edit.op === 'remove' ? st.removedAt : startOf(edit)),
		rebase(now, which) {
			st.before = now.text;
			Object.assign(node.dataset, { start: String(now.start), end: String(now.end), key: now.key });
			if (which === 'theirs') node.replaceChildren(...renderMarkdown(now.text));
		},
		/** Backspace at the start: this paragraph joins the one above, as one saved edit. */
		merge(s: Session, prev: BlockNode) {
			const joined = el('div', renderMarkdown(prev._text ?? ''));
			const at = (joined.textContent ?? '').length;
			joined.firstElementChild!.append(...[...node.querySelector('p')!.childNodes].map((c) => c.cloneNode(true)));
			const r = bodyMarkdown(joined);
			if ('problem' in r) return;
			// Named by the two blocks' keys, as the person saw them; the engine finds their bytes, whatever lies between.
			const start = Number(prev.dataset.start);
			void s.save({ op: 'join', date: node.dataset.date!, first: prev.dataset.key!, second: node.dataset.key!, text: r.md }, at, start);
		},
		/** An entry with no title takes one from any of its writing: this is saved, then the entry's title opens in place. */
		canTitle: () => {
			const head = entryHeadOf(node);
			return head !== null && !head.classList.contains('has-title');
		},
		addTitle() {
			const head = entryHeadOf(node);
			const s = node._editor;
			if (head === null || s == null) return;
			void s.finish({ then: 'stay' }).then((problem) => {
				if (problem === null) s.host.open(head)?.act('title');
			});
		},
		/** The entry's time can be taken off or put on from any of its writing, as from its heading (GM, 2026-11-19). */
		timed: () => {
			const head = entryHeadOf(node);
			return head !== null && !head.classList.contains('no-time');
		},
		setTimed(on: boolean) {
			const head = entryHeadOf(node);
			const s = node._editor;
			if (head === null || s == null) return;
			const date = head.dataset.date!;
			const key = head.dataset.key!;
			void s.finish({ then: 'stay' }).then((problem) => {
				// The save may have moved the heading; it is found again by its key, which a save of the writing keeps.
				const now = problem === null ? head.parentElement?.querySelector<BlockNode>(`.block[data-date="${date}"][data-key="${key}"]`) : null;
				if (now != null) s.host.open(now)?.act(on ? 'addtime' : 'notime');
			});
		},
	};
}

/**
 * The edit that removes `node`'s whole entry, when `node` is the only writing of an entry with a time and no title; null
 * otherwise. A time alone is not worth keeping: deleting the writing deletes the entry. The entry is named by its heading's
 * key, and the engine finds the bytes.
 */
function emptiedEntry(node: BlockNode): Extract<Edit, { op: 'remove' }> | null {
	const head = node.previousElementSibling as BlockNode | null;
	if (head === null || !head.classList.contains('entry-head') || head.classList.contains('has-title') || head.dataset.key === undefined) return null;
	let next = node.nextElementSibling as BlockNode | null;
	while (next !== null && next.classList.contains('draft')) next = next.nextElementSibling as BlockNode | null;
	if (next !== null && !next.classList.contains('entry-head')) return null;
	return { op: 'remove', date: node.dataset.date!, entry: head.dataset.key };
}

/** The start of a line that makes it a list, a to-do, a quote or a heading, not a title. */
export const BLOCKISH_RE = /^(?:[-*+] |\d+[.)] |> |\[ ?\] |#)/;

/** A time as the person types it: an hour of one digit is taken (`9:30`), and saved as `09:30`. */
export const TYPED_TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** The time and title a heading's places hold (either may be null, not both), or what is wrong; only `textContent` of
 * the time is read, and an empty time is none. */
export type Heading = { time: string | null; title: string | null } | { problem: string };

/** Read a time and title into an entry heading's parts, or say what is wrong. */
export function headingMarkdown(time: Pick<Node, 'textContent'>, title: Node | null): Heading {
	const t = (time.textContent ?? '').trim();
	const words = title === null ? '' : inlineMarkdown(readInlines(title)).trim();
	const named = words === '' ? null : words;
	// A title is one line of words: one that starts like a list, a quote or a heading is writing typed in the wrong place
	// ("- milk" typed as a title would be saved as the heading "## - milk"; GM, 2026-11-19).
	if (BLOCKISH_RE.test((title?.textContent ?? '').trim())) return { problem: say('journal.view.write.titleShape') };
	if (t === '') {
		// No time: the title holds the entry, and must read back as a title (not start like a time).
		return named !== null && entryOf(entryHeading(null, named))?.time === null ? { time: null, title: named } : { problem: say('journal.view.write.untimed') };
	}
	if (!TYPED_TIME_RE.test(t)) return { problem: say('journal.view.write.timeShape') };
	return { time: t.padStart(5, '0'), title: named };
}

/** The time now, `HH:MM`, where the person is. `now` is for tests. */
export const timeNow = (now = new Date()): string => now.toTimeString().slice(0, 5);

/**
 * The time of a heading being written, taken off or put back (the bar's No time and Add time). Off, the time's place is
 * emptied and hidden, the entry is marked `no-time`, and the title is opened, since it now holds the entry; back on, the
 * time it had returns, or the time now.
 */
export function timeSwitch(node: HTMLElement, time: HTMLElement, title: () => HTMLElement | null, addTitle: () => void) {
	let kept = (time.textContent ?? '').trim();
	return {
		timed: () => !time.hidden,
		setTimed(on: boolean) {
			if (on) {
				time.hidden = false;
				time.textContent = kept === '' ? timeNow() : kept;
				node.classList.remove('no-time');
				return time.focus();
			}
			kept = (time.textContent ?? '').trim() || kept;
			time.textContent = '';
			time.hidden = true;
			node.classList.add('no-time');
			const t = title();
			if (t === null) addTitle();
			else t.focus();
		},
	};
}

export function headingSpec(node: BlockNode): Spec {
	const time = node.querySelector<HTMLElement>('.time')!;
	let title = node.querySelector<HTMLElement>('.title');
	const st = { before: node._text ?? '', shown: clones(node), hadTitle: title !== null, hadNoTime: node.classList.contains('no-time') };
	function addTitle(): void {
		node.classList.add('has-title');
		title = el('span', [el('br')], { class: 'title', 'data-placeholder': say('journal.view.write.title') });
		node.append(title);
		node._editor?.arm(title);
		title.focus();
	}
	const timing = timeSwitch(node, time, () => title, addTitle);
	return {
		kind: 'heading',
		root: time,
		editables: () => [time, title].filter((e): e is HTMLElement => e !== null && !e.hidden),
		focusTarget: () => title ?? time,
		read() {
			const h = headingMarkdown(time, title);
			if ('problem' in h) return h;
			const md = entryHeading(h.time, h.title);
			return { edit: md === st.before ? null : { op: 'replace', ...range(node), before: st.before, after: md } };
		},
		restore() {
			node.replaceChildren(...st.shown.map((c) => c.cloneNode(true)));
			node.classList.toggle('has-title', st.hadTitle);
			node.classList.toggle('no-time', st.hadNoTime);
		},
		// A heading with a time may have moved into time order: it lands where it now is, found by its time (one entry to a
		// time). One with none stays where it was.
		landing: ({ edit, res }) => {
			const time = 'after' in edit ? entryOf(edit.after)?.time ?? null : null;
			const moved = time === null ? undefined : res.day.blocks.find((b) => entryOf(b.text)?.time === time);
			return moved?.start ?? startOf(edit);
		},
		enter(target) {
			if (target === time && title !== null) title.focus();
			else void node._editor?.finish({ then: 'next' });
			return true;
		},
		canTitle: () => title === null,
		addTitle,
		timed: timing.timed,
		setTimed: timing.setTimed,
		/** Delete on a heading removes the whole entry: its time, title and writing. */
		remove(s) {
			void s.save({ op: 'remove', date: node.dataset.date!, entry: node.dataset.key! }, 'stay', Number(node.dataset.start));
		},
	};
}
