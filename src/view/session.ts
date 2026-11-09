// The shapes a writing session is made of (see `editor.ts`), in one place so the editor, the specs and the drafts
// import types, never each other in a circle. Nothing here holds state: every session belongs to one mount's `Page`.
import type { Block, Day, Edit, EditResult, RangeEdit } from './wire.ts';
import type { Bar } from './bar.ts';

/** A block on the page: its file text and, while it is written in, its session. */
export interface BlockNode extends HTMLElement {
	_text?: string;
	_editor?: Session | null;
}

/** Where the caret goes: a character count, `'end'`, or the point that was clicked. */
export type Where = number | 'end' | { x: number; y: number };

/** Where the person goes after a save: stay, back on the block, the next one, the end of the one above, or a count. */
export type Then = 'stay' | 'self' | 'next' | 'prevEnd' | number;

export type Saved = { edit: Edit; res: Extract<EditResult, { ok: true }> };
export type Read = { edit: Edit | null } | { problem: string };

/**
 * What a session saves. A session is the same whether it edits a block, a new paragraph or a new entry; only its
 * spec differs (`specs.ts`, `drafts.ts`).
 */
export interface Spec {
	/** What the bar offers. */
	kind: 'body' | 'heading' | 'draft' | 'entry';
	/** The element holding the writing's blocks; the block itself when absent. */
	root?: HTMLElement;
	/** The elements that take typing. */
	editables(): HTMLElement[];
	focusTarget?(): HTMLElement;
	/** `{ edit }` (null when there is nothing to save) or `{ problem }`. */
	read(): Read;
	/** Put the page back when nothing was saved. */
	restore(): void;
	/** Where the saved writing now starts in the file. */
	landing(saved: Saved): number;
	rebase?(now: Block, which: 'mine' | 'theirs'): void;
	merge?(s: Session, prev: BlockNode): void;
	enter?(target: EventTarget | null): boolean;
	canTitle?(): boolean;
	addTitle?(): void;
	/** Whether the entry has a time (true) or none (false); absent when the writing has no say in it. */
	timed?(): boolean;
	/** Gives the entry a time again, or takes it away (a title then holds the entry). */
	setTimed?(on: boolean): void;
	remove?(s: Session): void;
}

export interface Session {
	node: BlockNode;
	host: Page;
	spec: Spec;
	kind: Spec['kind'];
	root: HTMLElement;
	busy: boolean;
	/** The save on its way, or null. */
	saving: Promise<string | null> | null;
	/** The block above, kept when this one is removed so the caret can go to its end. */
	prev?: BlockNode | null;
	canTitle(): boolean;
	/** The bar's No time (true) or Add time (false); null when neither applies. */
	timed(): boolean | null;
	focus(where?: Where): void;
	act(name: string, restore?: () => void): void;
	arm(e: HTMLElement): void;
	/** Null once nothing is left unsaved, else why not. */
	finish(o?: { then?: Then }): Promise<string | null>;
	save(edit: Edit, then: Then, landing?: number | null): Promise<string | null>;
	/** Close without saving, the block as it was. */
	discard(): void;
	remove(): void;
	stale(day: Day): void;
}

/** One mount's page, as every writing session sees it: its routes, its bar, its undo and its one open session. */
export interface Page {
	edit(e: Edit): Promise<EditResult>;
	/** Bring a day's elements in line with `day`; `fresh` marks new blocks (the bot's, not the person's). */
	patch(day: Day, fresh?: boolean): void;
	refresh(date: string): Promise<void>;
	undo(undo: RangeEdit, label: string): void;
	blockAt(date: string, start: number): BlockNode | null;
	focusAt(date: string, start: number): void;
	open(node: BlockNode, at?: Where): Session | null;
	draftAfter(anchor: BlockNode): Session;
	ask(node: BlockNode): void;
	/** Says a refusal, through the host. */
	notify(text: string, tone?: 'info' | 'error'): void;
	bar: Bar;
	/** The one session open in this mount, or null. */
	sessions: { current: Session | null };
	/** The id of this mount's "Press Enter to write here." line, which every block points at. */
	hintId: string;
}

export const isEditing = (node: Element): boolean => (node as BlockNode)._editor != null;

/** The heading of the entry `node` sits under (`node` itself when it is one), read from the page; null above the first. */
export function entryHeadOf(node: BlockNode): BlockNode | null {
	let head: Element | null = node.classList.contains('entry-head') ? node : node.previousElementSibling;
	while (head !== null && !head.classList.contains('entry-head')) head = head.previousElementSibling;
	return head as BlockNode | null;
}

/** Where an edit that names a place in the file starts, or NaN. */
export const startOf = (e: Edit): number => ('start' in e ? e.start : NaN);
