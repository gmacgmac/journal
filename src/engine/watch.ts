// `watch(onChange)`: every day file that appeared, changed or went, from anyone (this engine, the bot's own file tools, the
// person's editor), said as `{ date }` (docs/specification/plugin.md § Watching). It POLLS: nclite's jail allows no system
// file watcher. While a watcher is subscribed, every poll stats the month folders and reads the day files of any month whose
// folder changed and of the current and previous month; every sweep reads every day file. A file's identity is its
// modification time, size and inode, and the first pass only records. Many writes between two polls are one change, and a
// pass with more than `maxEvents` changed days says one catch-up `{}` instead (the view reads every day it shows again).
import fs from 'node:fs';
import path from 'node:path';
import type { Ref } from '../vendor/plugin-host/plugin-host.ts';
import { addDays, dateOfPath, localToday } from '../format/index.ts';
import { monthFolders } from '../store/index.ts';

export const WATCH_POLL_MS = 1000;
export const WATCH_SWEEP_MS = 30000;
export const WATCH_MAX_FILES = 20000;
/** The most days one pass says one by one; more is one catch-up `{}`. */
export const WATCH_MAX_EVENTS = 50;

export interface WatchOptions {
	pollMs: number;
	sweepMs: number;
	maxFiles: number;
	/** Above this many changed days in one pass, the pass says `{}` once. */
	maxEvents: number;
	/** The person's today, `YYYY-MM-DD`; its month and the one before are read on every poll. */
	today: () => string;
}

const DEFAULTS: WatchOptions = { pollMs: WATCH_POLL_MS, sweepMs: WATCH_SWEEP_MS, maxFiles: WATCH_MAX_FILES, maxEvents: WATCH_MAX_EVENTS, today: () => localToday() };

const idOf = (s: fs.Stats): string => `${s.mtimeMs}:${s.size}:${s.ino}`;
const monthOf = (date: string): string => `${date.slice(0, 4)}/${date.slice(5, 7)}`;
const gone = (e: unknown): boolean => ['ENOENT', 'ENOTDIR'].includes((e as NodeJS.ErrnoException).code ?? '');

/** What the folder `dir` holds, compared with what it held at the last pass. */
export function createScanner(dir: string, options: Pick<WatchOptions, 'maxFiles' | 'today'>) {
	const months = new Map<string, string>();
	const files = new Map<string, string>();
	let primed = false;
	let full = false;

	/** Reads one month's day files; the dates that appeared, changed or went go into `changed`. */
	function readMonth(month: string, changed: Set<string>): void {
		const seen = new Set<string>();
		let names: string[] = [];
		try {
			names = fs.readdirSync(path.join(dir, month));
		} catch (e) {
			if (!gone(e)) throw e;
		}
		for (const name of names.sort()) {
			const date = dateOfPath(`${month}/${name}`);
			if (date === null) continue;
			if (!files.has(date) && files.size >= options.maxFiles) {
				full = true;
				continue;
			}
			let id: string;
			try {
				id = idOf(fs.lstatSync(path.join(dir, month, name)));
			} catch (e) {
				if (gone(e)) continue;
				throw e;
			}
			seen.add(date);
			if (files.get(date) !== id) changed.add(date);
			files.set(date, id);
		}
		for (const date of files.keys()) {
			if (monthOf(date) === month && !seen.has(date)) {
				files.delete(date);
				changed.add(date);
			}
		}
	}

	return {
		/** True once the file cap left a day file unwatched. */
		get capped() {
			return full;
		},
		/**
		 * One pass: `sweep` reads every month's files. Returns the dates that changed (none on the first pass, which only
		 * records) and the first failure to read, if any; a month that failed is read again on the next pass.
		 */
		scan(sweep: boolean): { changed: string[]; error: unknown } {
			const changed = new Set<string>();
			let error: unknown = null;
			const today = options.today();
			const always = new Set([monthOf(today), monthOf(addDays(`${today.slice(0, 7)}-01`, -1))]);
			const listed: string[] = [];
			try {
				listed.push(...monthFolders(dir));
			} catch (e) {
				return { changed: [], error: e };
			}
			for (const month of listed) {
				try {
					const id = idOf(fs.statSync(path.join(dir, month)));
					if (sweep || !primed || always.has(month) || months.get(month) !== id) {
						readMonth(month, changed);
						months.set(month, id);
					}
				} catch (e) {
					months.delete(month);
					error ??= e;
				}
			}
			for (const month of [...months.keys()]) {
				if (listed.includes(month)) continue;
				months.delete(month);
				try {
					readMonth(month, changed);
				} catch (e) {
					error ??= e;
				}
			}
			const first = !primed;
			primed = true;
			return { changed: first ? [] : [...changed].sort(), error };
		},
		/** This engine wrote `date`: record the file as it now is, so the next pass does not say it again. */
		record(date: string): void {
			if (!primed) return;
			try {
				files.set(date, idOf(fs.lstatSync(path.join(dir, monthOf(date), `${date}.md`))));
			} catch {
				files.delete(date);
			}
		},
	};
}

/**
 * The engine's watch over `dir`: `watch` subscribes (the first subscriber starts the polls, the last one's stop ends them),
 * and `wrote` says a day this engine saved at once. A failure to read is `warn`ed once, until a pass succeeds again; nothing
 * throws out of the timer, nor out of a listener.
 */
export function createWatch(dir: string, warn: (message: string) => void, opts: Partial<WatchOptions> = {}) {
	const o = { ...DEFAULTS, ...opts };
	const listeners = new Set<(ref: Ref) => void>();
	let scanner: ReturnType<typeof createScanner> | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;
	let lastSweep = 0;
	let failing = false;
	let warnedCap = false;

	const emit = (ref: Ref) => {
		for (const listener of [...listeners]) {
			try {
				listener(ref);
			} catch {
				// A listener's failure is its own; the others still hear.
			}
		}
	};

	function tick(): void {
		if (scanner === null) return;
		const sweep = Date.now() - lastSweep >= o.sweepMs;
		if (sweep) lastSweep = Date.now();
		const { changed, error } = scanner.scan(sweep);
		if (changed.length > o.maxEvents) emit({});
		else for (const date of changed) emit({ date });
		if (error !== null && !failing) warn(`journal: the data folder could not be read: ${(error as Error).message ?? String(error)}`);
		failing = error !== null;
		if (scanner.capped && !warnedCap) {
			warnedCap = true;
			warn(`journal: more than ${o.maxFiles} day files; the rest are not watched`);
		}
	}

	const safeTick = () => {
		try {
			tick();
		} catch (e) {
			if (!failing) warn(`journal: watch failed: ${(e as Error).message}`);
			failing = true;
		}
	};

	return {
		watch(onChange: (ref: Ref) => void): () => void {
			const listener = (ref: Ref) => onChange(ref);
			listeners.add(listener);
			if (timer === null) {
				scanner = createScanner(dir, o);
				lastSweep = 0;
				safeTick();
				timer = setInterval(safeTick, o.pollMs);
				timer.unref?.();
			}
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0 && timer !== null) {
					clearInterval(timer);
					timer = null;
					scanner = null;
				}
			};
		},
		wrote(date: string): void {
			scanner?.record(date);
			emit({ date });
		},
	};
}
