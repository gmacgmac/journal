// The seam's types: the source of `plugin.d.ts` (bin/types.ts emits it after the contract's own declarations). This file may
// import the contract copy and nothing else; the import is left out of the emitted file.
// The engine's shapes are the spec's (docs/specification/plugin.md § Routes, § References, § Tools).
import type { PluginEngine, PluginEngineOptions, PluginHost, PluginView } from './vendor/plugin-host/plugin-host.ts';

/** The view's one export: shows the Journal in `root`, on the host it is given. */
export declare function mount(root: HTMLElement, host: PluginHost): PluginView;

/** The engine's one export. */
export declare function createEngine(options: PluginEngineOptions): PluginEngine;

/** A `block` chip's ref: the block with that key on that day. */
export interface BlockRef {
	date: string;
	key: string;
}

/** A `days` chip's ref: the days from `from` to `to`, both included. */
export interface DaysRef {
	from: string;
	to: string;
}

/** One top-level block of a day file: its key, its place in the file (UTF-16 offsets) and its source text. */
export interface Block {
	key: string;
	start: number;
	end: number;
	text: string;
}

/** One day as `GET days` answers it. */
export interface Day {
	/** `YYYY-MM-DD` */
	date: string;
	/** `Saturday 7 November 2026` */
	title: string;
	exists: boolean;
	/** The first 16 hex digits of the sha256 of the whole file; null when there is no file, or it is not read. */
	version: string | null;
	/** Empty when there is no file, or it is not read. */
	blocks: Block[];
	/** The Journal's sentences: what is wrong with the day. Empty for a day that keeps the rules. */
	problems: string[];
}

/** The four edits `POST edit` takes, each anchored to bytes the view saw. */
export type Edit =
	| { op: 'replace'; date: string; start: number; end: number; before: string; after: string }
	| { op: 'insert'; date: string; start: number; end: number; before: string; text: string }
	| { op: 'entry'; date: string; time: string; title: string | null; text: string }
	| { op: 'range'; date: string; start: number; end: number; before: string; after: string };

/** Exact bytes swapped for others: how an undo is applied. */
export type RangeEdit = Extract<Edit, { op: 'range' }>;

/** `GET days`, 200: whole days from `from`; `next` the first day left out when the answer was full. */
export interface DaysAnswer {
	days: Day[];
	next?: string;
}

/** `POST edit`, 200: the day as it now is, and the edit that undoes this one. */
export interface EditAnswer {
	day: Day;
	undo: RangeEdit;
}

/** A route's problem: the sentence, the reply's status, a code, and the day as it now is when there is one. */
export interface RouteProblem {
	title: string;
	status: number;
	code: string;
	day?: Day;
}

/** One day as `read_days` gives it: its file's text as it is (`''` when there is none or it is not read). */
export interface ReadDay {
	date: string;
	title: string;
	exists: boolean;
	version: string | null;
	text: string;
	problems: string[];
}

/** `read_days`' `structuredContent`: whole days from `from`; `next` the first day not read, when the range did not fit. */
export interface ReadResult {
	days: ReadDay[];
	next?: string;
}

/** A write tool's `structuredContent`: the day, its new version, the entry's time, and the changed or new block's key. */
export interface WriteResult {
	date: string;
	version: string;
	entry: string;
	/** Absent for a removal. */
	key?: string;
}
