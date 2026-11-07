// WRITING IN PLACE. A block becomes editable where it stands, in its own type and its own box, so nothing on the page
// moves when an editor opens, and bold shows as bold. On Done, Esc, ⌘↵, Enter or leaving the block, what is on screen
// is read back as a tree (`dom-tree.ts`), written as Markdown (the vendored serializer), checked to read back the
// same, and sent as one edit. Every saved edit can be undone (`undo.ts`).
//
// One session at a time per mount, held on the mount's page (`host.sessions`), never in this module. A session is
// the same whether it edits a block, a new paragraph or a new entry; only its spec differs (`session.ts` § Spec).
import { blocksMarkdown, parseMarkdown } from '../vendor/markdown/index.ts';
import type { Day, DayBlock, Edit, EditResult } from './app.ts';
import { warn } from './bar.ts';
import { placeCaret, placeCaretAtPoint, selection } from './caret.ts';
import { readBlocks, same } from './dom-tree.ts';
import { onBeforeInput, onInput, onKeyDown, toTodo } from './editor-keys.ts';
import type { BlockNode, Page, Session, Spec, Then, Where } from './session.ts';

export { isEditing } from './session.ts';

/** Save whatever is being written now: the view is going away (`mount`'s `unmount`). */
export function finishOpen(host: Page): void {
	void host.sessions.current?.finish({ then: 'stay' });
}

/** The writing under `root` as Markdown, or why it can't be saved as it looks. */
export function bodyMarkdown(root: Node): { md: string } | { problem: string } {
	const blocks = readBlocks(root);
	if (blocks.length === 0) return { md: '' };
	const md = blocksMarkdown(blocks);
	return same(parseMarkdown(md), blocks) ? { md } : { problem: 'This can’t be saved exactly as it looks, so nothing was saved.' };
}

export function startSession(node: BlockNode, host: Page, spec: Spec, at: Where = 'end'): Session {
	const { bar, sessions } = host;
	const open = sessions.current;
	if (open !== null && open.node !== node) void open.finish({ then: 'stay' });
	const listening = new AbortController();
	const s: Session = {
		node, host, spec, kind: spec.kind, root: spec.root ?? node, busy: false,
		canTitle: () => spec.addTitle !== undefined && spec.canTitle?.() === true,
		focus(where = 'end') {
			if (typeof where === 'object') {
				const { x, y } = where;
				const hit = spec.editables().find((e) => e.contains(document.elementFromPoint(x, y)));
				if (hit !== undefined) {
					hit.focus({ preventScroll: true });
					if (placeCaretAtPoint(x, y, hit)) return;
				}
				where = 'end';
			}
			const first = spec.focusTarget?.() ?? (where === 0 ? spec.editables()[0] : spec.editables().at(-1));
			if (first === undefined) return;
			first.focus({ preventScroll: true });
			placeCaret(first, where);
		},
		act, arm, finish, save, remove, stale,
	};
	node._editor = s;
	sessions.current = s;
	node.classList.add('editing');
	for (const e of spec.editables()) arm(e);
	node.addEventListener('focusout', (e) => {
		if (!(e.relatedTarget instanceof Node && node.contains(e.relatedTarget)) && !bar.inBar(e.relatedTarget)) void finish({ then: 'stay' });
	}, { signal: listening.signal });
	bar.showBar(s);
	s.focus(at);
	// Keep the writing clear of the bar, without moving the page when it already is.
	node.scrollIntoView({ block: 'nearest' });
	return s;

	function arm(e: HTMLElement): void {
		e.contentEditable = 'true';
		e.setAttribute('role', 'textbox');
		e.setAttribute('aria-multiline', String(e === s.root && s.kind !== 'heading'));
		e.addEventListener('keydown', (ev) => onKeyDown(ev, s), { signal: listening.signal });
		e.addEventListener('beforeinput', (ev) => onBeforeInput(ev, s), { signal: listening.signal });
		e.addEventListener('input', (ev) => onInput(ev as InputEvent, s), { signal: listening.signal });
	}

	function close(): void {
		listening.abort();
		for (const e of [node, ...node.querySelectorAll('[contenteditable=true]')].filter((x) => x.getAttribute('contenteditable') === 'true')) {
			e.removeAttribute('contenteditable');
			e.removeAttribute('role');
			e.removeAttribute('aria-multiline');
		}
		node.classList.remove('editing', 'stale', 'busy');
		node._editor = null;
		if (sessions.current === s) sessions.current = null;
		bar.hideBar(s);
	}

	function act(name: string, restore = () => {}): void {
		const target = spec.editables().find((e) => e.contains(selection().anchorNode)) ?? spec.editables().at(-1);
		target?.focus({ preventScroll: true });
		restore();
		if (name === 'bold' || name === 'italic') document.execCommand(name);
		else if (name === 'link') link();
		else if (name === 'todo') toTodo(s);
		else if (name === 'title') {
			spec.addTitle?.();
			bar.showBar(s);
		}
		else if (name === 'ask') host.ask(node);
		else if (name === 'remove') remove();
		else if (name === 'done') void finish({ then: 'self' });
	}

	function link(): void {
		const sel = selection();
		const inLink = sel.anchorNode?.parentElement?.closest('a, [data-href]');
		if (inLink && node.contains(inLink)) return void document.execCommand('unlink');
		if (sel.isCollapsed) return bar.say(warn('Select the words to link first.'));
		bar.askLink((url) => {
			if (!/^(https?:\/\/\S+|mailto:\S+)$/.test(url)) return bar.say(warn('A link needs an address that starts with https://.'));
			document.execCommand('createLink', false, url);
		});
	}

	/** Save what is on screen; `then` says where the person goes next. */
	async function finish({ then = 'stay' }: { then?: Then } = {}): Promise<void> {
		if (s.busy || node._editor !== s) return;
		const r = spec.read();
		if ('problem' in r) return bar.say(warn(r.problem));
		if (r.edit === null) {
			close();
			spec.restore();
			return land(then, Number(node.dataset.start));
		}
		return save(r.edit, then);
	}

	async function save(edit: Edit, then: Then, landing: number | null = null): Promise<void> {
		s.busy = true;
		node.classList.add('busy');
		const res = await host.edit(edit);
		s.busy = false;
		node.classList.remove('busy');
		if (res.ok) {
			close();
			node.remove();
			host.patch(res.day, false);
			host.undo(res.undo, 'after' in edit && edit.after === '' ? 'Deleted.' : 'Saved.');
			return land(then, landing ?? spec.landing({ edit, res }));
		}
		if (res.day) host.patch(res.day);
		refused(res);
	}

	function land(then: Then, start: number): void {
		const here = Number.isNaN(start) ? null : host.blockAt(node.dataset.date!, start);
		const next = here?.nextElementSibling as BlockNode | null | undefined;
		if (then === 'self') here?.focus();
		// After a heading: its first paragraph, or a new one when the entry has none.
		else if (then === 'next' && next?.classList.contains('block') && !next.classList.contains('entry-head')) host.open(next, 0);
		else if (then === 'next' && here !== null) host.draftAfter(here);
		else if (then === 'prevEnd' && s.prev?.isConnected) host.open(s.prev, 'end');
		else if (typeof then === 'number' && here !== null) host.open(here, then);
	}

	function remove(): void {
		const above = node.previousElementSibling;
		s.prev = above?.classList.contains('block') ? above as BlockNode : null;
		if (spec.remove) return spec.remove(s);
		s.root.replaceChildren();
		void finish({ then: 'prevEnd' });
	}

	function refused(res: Extract<EditResult, { ok: false }>): void {
		sessions.current = s;
		bar.showBar(s);
		s.focus();
		if (res.status !== 409 || spec.rebase === undefined) return bar.say(warn(res.reason));
		const now = blockAtStart(res.day, node);
		bar.clash(res.reason, now, () => rebase(now, 'mine'), () => rebase(now, 'theirs'));
	}

	/** The block changed on disk while open: the words stay, and the person chooses. */
	function stale(day: Day): void {
		node.classList.add('stale');
		if (spec.rebase === undefined) return bar.say(warn('The page changed round this while you were writing.'));
		const now = blockAtStart(day, node);
		bar.clash('This part just changed on the page. Your words are still here.', now, () => rebase(now, 'mine'), () => rebase(now, 'theirs'));
	}

	function rebase(now: DayBlock | null, which: 'mine' | 'theirs'): void {
		// The proof's own behaviour: the choice is offered only with a block to rebase onto (`clash` draws no buttons otherwise).
		if (now === null) return;
		node.parentElement?.querySelector(`.block[data-key="${now.key}"]:not(.editing)`)?.remove();
		spec.rebase?.(now, which);
		node.classList.remove('stale');
		bar.say();
		s.focus();
	}
}

const blockAtStart = (day: Day | null, node: BlockNode): DayBlock | null =>
	day?.blocks.find((b) => b.start === Number(node.dataset.start)) ?? null;
