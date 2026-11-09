// The writing bar: fixed under the page while a block is being written in, so opening an editor never moves a line of
// the page. It holds the formatting, the block's actions, the link field, and anything the page has to say.
//
// Its buttons never take focus from the writing (mousedown is cancelled), and a keyboard user who tabs into it gets
// the selection put back before it acts. One bar per mount: `createBar` keeps everything it knows inside.
import type { Block } from './wire.ts';
import { keepSelection } from './caret.ts';
import { el, renderMarkdown } from './render.ts';
import type { Session } from './session.ts';
import { say } from './words.ts';

export interface Bar {
	inBar(node: EventTarget | null): boolean;
	/** Show the bar for `s`; its kind decides which tools make sense. */
	showBar(s: Session): void;
	hideBar(s?: Session): void;
	/** Say something in the bar; nothing clears it. */
	say(...parts: Node[]): void;
	/** The page's current version of a block, drawn as it reads, with the two ways on. */
	clash(reason: string, current: Block | null, keep: () => void, take: () => void): void;
	/** Ask for a link's address; `apply` gets it with the selection back in place. */
	askLink(apply: (url: string) => void): void;
}

export const warn = (text: string): HTMLElement => el('p', [text], { class: 'warn' });

/** Wire the bar the view drew (`draw.ts`). */
export function createBar(bar: HTMLElement): Bar {
	const notice = bar.querySelector<HTMLElement>('.bar-notice')!;
	const linkForm = bar.querySelector<HTMLFormElement>('.bar-link')!;
	const linkInput = linkForm.querySelector('input')!;
	let session: Session | null = null;
	let restore = () => {};

	/** The bar's height, kept on the view so the paper and the toast make room for it. */
	const room = () => bar.closest<HTMLElement>('.journal')?.style.setProperty('--journal-bar-h', `${bar.hidden ? 0 : bar.offsetHeight}px`);

	const api: Bar = {
		inBar: (node) => node instanceof Node && bar.contains(node),
		showBar(s) {
			session = s;
			bar.hidden = false;
			bar.dataset.kind = s.kind;
			bar.querySelector<HTMLElement>('[data-act=title]')!.hidden = !s.canTitle();
			const timed = s.timed();
			bar.querySelector<HTMLElement>('[data-act=notime]')!.hidden = timed !== true;
			bar.querySelector<HTMLElement>('[data-act=addtime]')!.hidden = timed !== false;
			linkForm.hidden = true;
			api.say();
		},
		hideBar(s) {
			if (s !== undefined && s !== session) return;
			session = null;
			bar.hidden = true;
			room();
		},
		say(...parts) {
			notice.replaceChildren(...parts);
			room();
		},
		clash(reason, current, keep, take) {
			const mine = el('button', [say('journal.view.clash.keep')], { type: 'button' });
			const theirs = el('button', [say('journal.view.clash.take')], { type: 'button' });
			mine.addEventListener('click', keep);
			theirs.addEventListener('click', take);
			if (current === null) return api.say(warn(reason), el('p', [say('journal.view.clash.gone')]));
			api.say(warn(reason), el('p', [say('journal.view.clash.now')]), el('blockquote', renderMarkdown(current.text), { class: 'current' }), el('div', [mine, theirs], { class: 'actions' }));
		},
		askLink(apply) {
			restore = keepSelection();
			linkForm.hidden = false;
			linkInput.value = 'https://';
			linkInput.focus();
			linkInput.select();
			linkForm.onsubmit = (e) => {
				e.preventDefault();
				linkForm.hidden = true;
				restore();
				apply(linkInput.value.trim());
			};
		},
	};

	bar.addEventListener('mousedown', (e) => {
		const t = e.target as Element;
		if (t.closest('button') !== null && t.closest('.bar-link') === null) e.preventDefault();
	});
	bar.addEventListener('focusin', (e) => {
		const t = e.target as Element;
		if (session !== null && t.closest('.bar-link') === null && !(e.relatedTarget instanceof Node && bar.contains(e.relatedTarget))) restore = keepSelection();
	});
	bar.addEventListener('click', (e) => {
		const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
		if (act === undefined || session === null) return;
		if (act === 'link-cancel') {
			linkForm.hidden = true;
			return session.focus();
		}
		// The session focuses its writing first, then puts the selection back, then acts.
		session.act(act, restore);
	});
	return api;
}
