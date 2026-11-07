// READING AND SAVING DAY FILES: the only code that touches the data folder (carried from the proof's `store.ts`).
//
// Every edit is anchored to bytes the editor saw and is refused, never merged, when they have changed (`edits.ts` plans it
// as pure text). A refusal comes back with the file as it is now, and the person decides. Every saved edit comes back with
// the edit that undoes it. A write is atomic: a reader sees the old file or the new one, never half of either.
//
// Nothing is read that is not a day file at its own path: a link, a folder, or a folder that leads out of the data folder
// is `odd`, shown as a problem and never written through.
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_DAY_BYTES, dateHeading, dayPath, isDate } from '../format/index.ts';
import type { Edit, RangeEdit } from '../seam-types.ts';
import { TOO_BIG_VARS, plan, undoOf, type Refusal } from './edits.ts';
import { dayFits } from './size.ts';

/**
 * What is at a day's path: nothing, a day's text, a day too big to read (over `MAX_DAY_BYTES`, or any other limit `dayFits`
 * holds), or something that is not a plain file.
 */
export type DayFile = { state: 'none' } | { state: 'text'; text: string } | { state: 'too-big' } | { state: 'odd' };

export type Applied = { ok: true; text: string; undo: RangeEdit } | (Refusal & { file: DayFile });

/** An edit planned and not yet written: the day's text after it, its undo, and the file it was planned on. */
export type Planned = { ok: true; text: string; undo: RangeEdit; file: DayFile } | (Refusal & { file: DayFile });

/** A day's version: the first 16 hex digits of the sha256 of the whole file. */
export function version(text: string): string {
	return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** The file for `date` under `dir`; throws if `date` is not a date or the path would land anywhere else. */
export function dayFile(dir: string, date: string): string {
	if (!isDate(date)) throw new Error('not a date');
	const root = path.resolve(dir);
	const file = path.resolve(root, dayPath(date));
	if (!file.startsWith(root + path.sep)) throw new Error('outside the data folder');
	return file;
}

/** Whether the folder holding `file`, links resolved, is inside `dir`. */
function folderInside(dir: string, file: string): boolean {
	const root = fs.realpathSync(dir);
	const folder = fs.realpathSync(path.dirname(file));
	return folder.startsWith(root + path.sep);
}

const missing = (e: unknown): boolean => ['ENOENT', 'ENOTDIR'].includes((e as NodeJS.ErrnoException).code ?? '');

/** What is at `date`'s path now. Throws only on a failure to read that is not "nothing there". */
export function readDayFile(dir: string, date: string): DayFile {
	const file = dayFile(dir, date);
	let fd: number;
	try {
		if (!fs.lstatSync(file).isFile() || !folderInside(dir, file)) return { state: 'odd' };
		fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
	} catch (e) {
		if (missing(e)) return { state: 'none' };
		if ((e as NodeJS.ErrnoException).code === 'ELOOP') return { state: 'odd' };
		throw e;
	}
	try {
		const stat = fs.fstatSync(fd);
		if (!stat.isFile()) return { state: 'odd' };
		if (stat.size > MAX_DAY_BYTES) return { state: 'too-big' };
		const bytes = Buffer.alloc(stat.size);
		let at = 0;
		while (at < bytes.length) {
			const n = fs.readSync(fd, bytes, at, bytes.length - at, at);
			if (n === 0) break;
			at += n;
		}
		const text = bytes.subarray(0, at).toString('utf8');
		return dayFits(text) ? { state: 'text', text } : { state: 'too-big' };
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * Writes `text` as `date`'s file: a temporary file `.<random>.tmp` in the day's own folder, synced where the runtime allows,
 * then renamed over it, so a reader sees the old day or the new one and never half of one. Under Node's permission model,
 * which nclite's jail runs the engine in, Node refuses fsync outright (`ERR_ACCESS_DENIED`); the rename still makes the
 * write atomic, so the save goes on without the sync (`syncIfAllowed`).
 */
/** Flushes `fd` to disk, unless the permission model refuses fsync, which it does for every file. */
function syncIfAllowed(fd: number): void {
	try {
		fs.fsyncSync(fd);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'ERR_ACCESS_DENIED') throw e;
	}
}

export function writeDay(dir: string, date: string, text: string): void {
	const file = dayFile(dir, date);
	const folder = path.dirname(file);
	fs.mkdirSync(folder, { recursive: true });
	if (!folderInside(dir, file)) throw new Error('outside the data folder');
	const tmp = path.join(folder, `.${randomBytes(8).toString('hex')}.tmp`);
	try {
		const fd = fs.openSync(tmp, 'wx', 0o644);
		try {
			fs.writeFileSync(fd, text);
			syncIfAllowed(fd);
		} finally {
			fs.closeSync(fd);
		}
		fs.renameSync(tmp, file);
	} catch (e) {
		fs.rmSync(tmp, { force: true });
		throw e;
	}
}

/**
 * Plans `e` against the day as it is, writing nothing. `e.date` must be a date. A day too big to read, or not a plain file,
 * takes no edit. The caller writes the plan with `writeDay` once its answer is known to fit.
 */
export function planEdit(dir: string, e: Edit): Planned {
	const file = readDayFile(dir, e.date);
	if (file.state === 'too-big') return { ok: false, status: 422, code: 'too-big', say: 'journal.problem.too-big', vars: TOO_BIG_VARS, file };
	if (file.state === 'odd') return { ok: false, status: 422, code: 'malformed', say: 'journal.problem.not-a-file', file };
	const text = file.state === 'text' ? file.text : null;
	const planned = plan(e.date, text, e);
	if (!planned.ok) return { ...planned, file };
	// A page this edit made is undone back to a bare page, never deleted.
	return { ok: true, text: planned.text, undo: undoOf(e.date, text ?? `${dateHeading(e.date)}\n`, planned.text), file };
}

/** Plans `e` and writes it when it is allowed. */
export function applyEdit(dir: string, e: Edit): Applied {
	const planned = planEdit(dir, e);
	if (!planned.ok) return planned;
	writeDay(dir, e.date, planned.text);
	return { ok: true, text: planned.text, undo: planned.undo };
}
