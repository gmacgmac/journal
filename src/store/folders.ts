// Walking the data folder: its year and month folders, and the dates that have a day file. Links are never followed (a
// `Dirent` of a link is not a directory), so a month folder that leads out of the data folder is never listed; a day path
// that is itself a link is listed and then read by `readDayFile`, which says it is `odd`.
import fs from 'node:fs';
import path from 'node:path';
import { dateOfPath } from '../format/index.ts';

const gone = (e: unknown): boolean => ['ENOENT', 'ENOTDIR'].includes((e as NodeJS.ErrnoException).code ?? '');

/** The folders under `dir` whose names match `re`, sorted; none when `dir` is not there. */
export function folders(dir: string, re: RegExp): string[] {
	try {
		return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && re.test(d.name)).map((d) => d.name).sort();
	} catch (e) {
		if (gone(e)) return [];
		throw e;
	}
}

/** The month folders, `YYYY/MM`, oldest first. */
export const monthFolders = (dir: string): string[] =>
	folders(dir, /^\d{4}$/).flatMap((year) => folders(path.join(dir, year), /^\d{2}$/).map((m) => `${year}/${m}`));

/**
 * The dates before `before` (not included) that have a day file, newest first, at most `count`. A name that is not a day
 * file at its own path is not one.
 */
export function datesWithPages(dir: string, before: string, count: number): string[] {
	const dates: string[] = [];
	for (const month of monthFolders(dir).reverse()) {
		if (`${month.replace('/', '-')}-01` >= before) continue;
		let names: string[];
		try {
			names = fs.readdirSync(path.join(dir, month));
		} catch (e) {
			if (gone(e)) continue;
			throw e;
		}
		const found = names.map((name) => dateOfPath(`${month}/${name}`)).filter((d): d is string => d !== null && d < before);
		dates.push(...found.sort().reverse());
		if (dates.length >= count) break;
	}
	return dates.slice(0, count);
}
