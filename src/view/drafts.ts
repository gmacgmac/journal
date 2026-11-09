// Writing that is not in the file yet. A draft is drawn where its writing will land, in the same columns, so saving
// it moves nothing; it is saved only once it has words, and an empty draft simply goes away.
//   paragraph  under an entry heading that has no writing yet; saved as an insert
//   entry      at the end of a day, its time filled in with now; the title is optional (Add title in the bar), and the
//              time can be taken off (No time: the title then holds the entry); saved as an entry, which also starts the
//              day's page when it has none
import { entryHeading } from '../format/index.ts';
import { bodyMarkdown, startSession } from './editor.ts';
import { el } from './render.ts';
import type { BlockNode, Page, Session } from './session.ts';
import { headingMarkdown, timeNow, timeSwitch } from './specs.ts';
import { say } from './words.ts';

const blank = () => el('p', [el('br')], { 'data-placeholder': say('journal.view.write.placeholder') });

/** A new paragraph after `anchor`, an existing block. */
export function draftAfter(anchor: BlockNode, host: Page): Session {
	const node: BlockNode = el('div', [blank()], { class: 'block draft', 'data-date': anchor.dataset.date! });
	anchor.after(node);
	return startSession(node, host, {
		kind: 'draft',
		editables: () => [node],
		read() {
			const r = bodyMarkdown(node);
			if ('problem' in r) return r;
			const { date, start, end } = anchor.dataset;
			return { edit: r.md === '' ? null : { op: 'insert', date: date!, start: Number(start), end: Number(end), before: anchor._text ?? '', text: r.md } };
		},
		restore: () => node.remove(),
		landing: ({ edit }) => ('end' in edit ? edit.end + 2 : NaN),
	}, 0);
}

/** A new entry at the end of `section`'s day. */
export function entryDraft(section: HTMLElement, host: Page): Session {
	let entries = section.querySelector<HTMLElement>('.entries');
	if (entries === null) {
		entries = el('div', [], { class: 'entries' });
		section.querySelector('header')!.after(entries);
	}
	const time = el('span', [timeNow()], { class: 'time', 'aria-label': say('journal.view.write.time') });
	const body = el('div', [blank()], { class: 'entry-body', 'aria-label': say('journal.view.write.entry') });
	// The title, once added, sits above the writing and outside it, as a heading's title does.
	const column = el('div', [body], { class: 'entry-column' });
	const node: BlockNode = el('div', [time, column], { class: 'block draft entry-draft', 'data-date': section.dataset.date! });
	entries.append(node);
	section.classList.add('drafting');
	let title: HTMLElement | null = null;
	function addTitle(): void {
		title = el('span', [el('br')], { class: 'title', 'data-placeholder': say('journal.view.write.title') });
		column.prepend(title);
		node._editor?.arm(title);
		title.focus();
	}
	const timing = timeSwitch(node, time, () => title, addTitle);
	return startSession(node, host, {
		kind: 'entry',
		root: body,
		editables: () => [time, title, body].filter((e): e is HTMLElement => e !== null && !e.hidden),
		focusTarget: () => body,
		read() {
			const h = headingMarkdown(time, title);
			if ('problem' in h) return h;
			const r = bodyMarkdown(body);
			if ('problem' in r) return r;
			if (r.md === '' && h.title === null) return { edit: null };
			return { edit: { op: 'entry', date: section.dataset.date!, time: h.time, title: h.title, text: r.md } };
		},
		restore() {
			node.remove();
			section.classList.remove('drafting');
		},
		landing({ edit, res }) {
			if (edit.op !== 'entry') return NaN;
			const blocks = res.day.blocks;
			const heading = entryHeading(edit.time, edit.title);
			// With no time the new entry went at the end: the last with that heading.
			const at = edit.time === null ? blocks.findLastIndex((b) => b.text === heading) : blocks.findIndex((b) => b.text === heading);
			return (edit.text === '' ? blocks[at] : blocks[at + 1])?.start ?? NaN;
		},
		enter(target) {
			if (target === body) return false;
			(target === time && title !== null ? title : body).focus();
			return true;
		},
		canTitle: () => title === null,
		addTitle,
		timed: timing.timed,
		setTimed: timing.setTimed,
	}, 0);
}
