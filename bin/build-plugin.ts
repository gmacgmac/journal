// `npm run build:plugin [-- --out <folder>]`: the journal as one plugin folder, `dist/plugin/journal/` by default:
// manifest.json, view/journal.js and view/journal.css (its faces in view/fonts/), engine/engine.js, words.json, skill.md, plugin.d.ts and vendored.json.
// A host copies the folder; nothing in it depends on how it was made. The same input gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { FONTS, manifestOf } from '../src/manifest.ts';
import { engineBuild, viewBuild } from '../vite.config.ts';
import { vendoredOf } from './sync-nclite.ts';
import { pluginTypes } from './types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const DEFAULT_OUT = path.join(ROOT, 'dist/plugin/journal');

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The manifest, words, skill, types and vendored.json as text, by the file's name in the folder. */
export function textFiles(): Record<string, string> {
	const { version } = JSON.parse(read('package.json')) as { version: string };
	return {
		'manifest.json': json(manifestOf(version)),
		'words.json': json(JSON.parse(read('words/words.json'))),
		'skill.md': read('skill/SKILL.md'),
		'plugin.d.ts': pluginTypes(),
		'vendored.json': json(vendoredOf()),
	};
}

/**
 * The view's own faces: each file `FONTS` names, and the licence, copied to `view/fonts/`, and the `@font-face` rules
 * (`src/view/fonts.css`) put at the top of the built sheet, at top level and as written (Vite would inline the files).
 */
function shipFonts(out: string): void {
	const from = path.join(ROOT, 'src/view/fonts');
	const to = path.join(out, 'view/fonts');
	fs.mkdirSync(to, { recursive: true });
	for (const name of [...FONTS, 'OFL-literata.txt']) fs.copyFileSync(path.join(from, name), path.join(to, name));
	const sheet = path.join(out, 'view/journal.css');
	fs.writeFileSync(sheet, `${read('src/view/fonts.css')}${fs.readFileSync(sheet, 'utf8')}`);
}

/** Write the folder `out` anew. */
export async function buildPlugin({ out = DEFAULT_OUT } = {}): Promise<string> {
	fs.rmSync(out, { recursive: true, force: true });
	await build(engineBuild(out));
	await build(viewBuild(out));
	shipFonts(out);
	for (const [name, text] of Object.entries(textFiles())) {
		fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
		fs.writeFileSync(path.join(out, name), text);
	}
	return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2);
	const at = args.indexOf('--out');
	const out = await buildPlugin({ out: at >= 0 ? path.resolve(args[at + 1]!) : DEFAULT_OUT });
	console.log(`plugin folder: ${path.relative(process.cwd(), out) || '.'}`);
}
