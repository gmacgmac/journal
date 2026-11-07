// The view's one door to the world: the proof's `app`, as a small internal interface. The view talks to nothing else,
// so pointing it at a real host (JR_04) is one adapter from that host to `JournalApp`, written in `view.ts`.
// The wire shapes below are what the Journal's own routes answer (`GET /days`, `POST /edit`).

/** One top-level block of a day file, with its place in the file and its screen key. */
export interface DayBlock {
	/** Offset of the block's first character. */
	start: number;
	/** Offset just past its last character. */
	end: number;
	text: string;
	/** Stable on screen: the text's hash and how many identical blocks come before it. */
	key: string;
}

/** One day as `GET /days` answers it; a day with no file is `exists: false` with no blocks. */
export interface Day {
	date: string;
	/** `Sunday 25 October 2026`, worked out by the engine, so the page never names a date itself. */
	title: string;
	exists: boolean;
	version?: string | null;
	blocks: DayBlock[];
}

/** The four edits `POST /edit` takes. `range` is exact bytes swapped for others: how an undo is applied. */
export type Edit =
	| { op: 'replace'; date: string; start: number; end: number; before: string; after: string }
	| { op: 'insert'; date: string; start: number; end: number; before: string; text: string }
	| { op: 'entry'; date: string; time: string; title: string | null; text: string }
	| { op: 'range'; date: string; start: number; end: number; before: string; after: string };

export type RangeEdit = Extract<Edit, { op: 'range' }>;

/** What `POST /edit` answers: the day as it now is, and the edit that undoes this one; or why not. */
export type EditResult =
	| { ok: true; day: Day; undo: RangeEdit }
	| { ok: false; status: number; reason: string; day: Day | null };

/** What a chip names: a block of a day, or the days shown. */
export type ChipRef = { date: string; key: string } | { from: string; to: string };

/** A reference for the chat, resolved by the host when it is sent. */
export interface Chip {
	kind: 'block' | 'days';
	ref: ChipRef;
	label: string;
	detail: string;
}

/** A day file changed, from anyone: the person, the bot, an editor. */
export interface DayEvent {
	ref: { date: string };
}

/** The host as the view sees it. Every member returns what the proof's page gave it. */
export interface JournalApp {
	/** The Journal's own routes, answered as parsed JSON: `GET /days?from&to` and `POST /edit` (`init.body` an `Edit`). */
	api(path: string, init?: { method?: string; body?: unknown }): Promise<unknown>;
	/** Call `fn` whenever a day file changes; returns the unsubscribe. */
	events(fn: (e: DayEvent) => void): () => void;
	/** A block or the days shown, as a reference in the chat. */
	addToChat(chip: Chip): void;
	/** `paper` (`light`, `dark`, `follow`) and `week-start` (`monday`, `sunday`). */
	settings: {
		get(key: string): string | undefined;
		on(fn: () => void): () => void;
	};
}

/** What `mount` hands back. */
export interface JournalView {
	unmount(): void;
	/** The days shown, as one chip. */
	pageChip(): Chip;
	/** Bring what a chip names into view and mark it. */
	reveal(ref: Partial<{ date: string; key: string; from: string; to: string }>): Promise<void>;
}
