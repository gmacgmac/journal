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
import { say } from './words.ts';

const range = (node: BlockNode) => ({ date: node.dataset.date!, start: Number(node.dataset.start), end: Number(node.dataset.end) });
const clones = (node: Node): Node[] => [...node.childNodes].map((c) => c.cloneNode(true));

export function bodySpec(node: BlockNode): Spec {
	const st = { before: node._text ?? '', shown: clones(node) };
	return {
		kind: 'body',
		editables: () => [node],
		read() {
			const r = bodyMarkdown(node);
			if ('problem' in r) return r;
			return { edit: r.md === st.before ? null : { op: 'replace', ...range(node), before: st.before, after: r.md } };
		},
		restore: () => node.replaceChildren(...st.shown.map((c) => c.cloneNode(true))),
		landing: ({ edit }) => startOf(edit),
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
			const start = Number(prev.dataset.start);
			void s.save({ op: 'range', date: node.dataset.date!, start, end: Number(node.dataset.end), before: `${prev._text}\n\n${st.before}`, after: r.md }, at, start);
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
	};
}

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
		landing: ({ edit }) => startOf(edit),
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
			const parts: BlockNode[] = [node];
			for (let n = node.nextElementSibling as BlockNode | null; n !== null && !n.classList.contains('entry-head'); n = n.nextElementSibling as BlockNode | null) {
				if (n.dataset.key !== undefined) parts.push(n);
			}
			const last = parts.at(-1)!;
			const next = last.nextElementSibling as BlockNode | null;
			const joined = parts.map((p) => p._text).join('\n\n');
			const start = Number(node.dataset.start);
			const end = Number(last.dataset.end);
			const date = node.dataset.date!;
			void s.save(next !== null
				? { op: 'range', date, start, end: Number(next.dataset.start), before: `${joined}\n\n`, after: '' }
				: { op: 'range', date, start: start - 2, end, before: `\n\n${joined}`, after: '' }, 'stay', start);
		},
	};
}
