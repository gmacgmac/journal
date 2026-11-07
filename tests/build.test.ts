import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { buildPlugin } from '../bin/build-plugin.ts';
import ts from 'typescript';
import { COPIES, MANIFEST, sha256, vendoredOf } from '../bin/sync-nclite.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PARTS = ['engine/engine.js', 'manifest.json', 'plugin.d.ts', 'skill.md', 'vendored.json', 'view/journal.css', 'view/journal.js', 'words.json'];

const filesOf = (dir: string): string[] =>
	fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort();

const diagnose = (files: string[]) => {
	const program = ts.createProgram(files, {
		noEmit: true, strict: true, skipLibCheck: false, types: [], allowImportingTsExtensions: true,
		lib: ['lib.es2024.d.ts', 'lib.dom.d.ts'], target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
	});
	return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
};

/** Every file under `dir`, by its `/`-joined path relative to `dir` (a copy may carry sub-folders). */
const filesIn = (dir: string): string[] =>
	(fs.readdirSync(dir, { recursive: true }) as string[])
		.filter((n) => fs.statSync(path.join(dir, n)).isFile())
		.map((n) => n.split(path.sep).join('/'));

describe('the plugin folder', () => {
	let tmp: string;
	let a: string;
	let b: string;
	before(async () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-build-'));
		a = await buildPlugin({ out: path.join(tmp, 'a') });
		b = await buildPlugin({ out: path.join(tmp, 'b') });
	});
	after(() => fs.rmSync(tmp, { recursive: true, force: true }));

	it('a clean build writes exactly the folder parts', () => {
		assert.deepEqual(filesOf(a), PARTS);
	});

	it('two builds give the same bytes', () => {
		for (const f of PARTS) assert.ok(fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f))), f);
	});

	it('a build clears what was in the folder before', async () => {
		fs.writeFileSync(path.join(a, 'stale.txt'), 'x');
		await buildPlugin({ out: a });
		assert.deepEqual(filesOf(a), PARTS);
	});

	it('the engine bundle imports only node: modules', () => {
		const text = fs.readFileSync(path.join(a, 'engine/engine.js'), 'utf8');
		const specs = [...text.matchAll(/(?:^|[\s;}])(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)]
			.map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]!);
		for (const s of specs) assert.match(s, /^node:/, `engine imports ${s}`);
	});

	it('the view is one file with no import, exporting only mount', async () => {
		const file = path.join(a, 'view/journal.js');
		const text = fs.readFileSync(file, 'utf8');
		assert.doesNotMatch(text, /^\s*import\b|\bimport\s*\(|\brequire\(/m);
		const mod = await import(`${file}?${Date.now()}`).catch(() => null);
		if (mod) assert.deepEqual(Object.keys(mod), ['mount']);
		else assert.match(text, /export\s*\{\s*\w+ as mount\s*\};?\s*$/);
	});

	it('the manifest names the files the folder holds', () => {
		const m = JSON.parse(fs.readFileSync(path.join(a, 'manifest.json'), 'utf8'));
		assert.ok(fs.existsSync(path.join(a, m.view.module)));
		for (const s of m.view.styles) assert.ok(fs.existsSync(path.join(a, s)));
		assert.ok(fs.existsSync(path.join(a, m.engine.module)));
	});

	it('vendored.json names every copied file by its nclite path, with its sha256', () => {
		const v = JSON.parse(fs.readFileSync(path.join(a, 'vendored.json'), 'utf8')) as Record<string, string>;
		assert.deepEqual(v, vendoredOf());
		assert.deepEqual(Object.keys(v), Object.keys(v).sort());
		for (const copy of COPIES) {
			const dir = path.join(ROOT, copy.dest);
			for (const f of filesIn(dir).filter((n) => n !== MANIFEST)) {
				assert.equal(v[copy.take ? `${copy.source}/${f}` : copy.source], sha256(fs.readFileSync(path.join(dir, f))), f);
			}
		}
		assert.ok(v['shared/plugin-host.ts'] && v['shared/markdown/parse.ts']);
	});

	it('plugin.d.ts is one module with no import, and compiles alone with the DOM types', () => {
		const file = path.join(a, 'plugin.d.ts');
		const text = fs.readFileSync(file, 'utf8');
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2024, true);
		assert.deepEqual(source.statements.filter((s) => ts.isImportDeclaration(s) || ts.isImportEqualsDeclaration(s)), []);
		assert.doesNotMatch(text, /\bfrom\s*['"]|\bimport\s*\(/);
		assert.ok(source.statements.some((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'mount'));
		assert.deepEqual(diagnose([file]), []);
	});

	it('a host that gives the contract\'s PluginHost compiles against it', () => {
		const host = path.join(tmp, 'host.ts');
		fs.writeFileSync(host, `import type * as plugin from './a/plugin.d.ts';
declare const host: plugin.PluginHost;
declare const root: HTMLElement;
declare const mount: typeof plugin.mount;
declare const createEngine: typeof plugin.createEngine;
export const view: plugin.PluginView = mount(root, host);
export const engine: plugin.PluginEngine = createEngine({} as plugin.PluginEngineOptions);
`);
		assert.deepEqual(diagnose([host]), []);
	});

	it('the folder names no absolute path or user name', () => {
		const user = os.userInfo().username;
		for (const f of PARTS) {
			const text = fs.readFileSync(path.join(a, f), 'utf8');
			assert.ok(!text.includes(ROOT), `${f} names the repo path`);
			assert.ok(!text.includes(os.homedir()), `${f} names the home folder`);
			assert.ok(!text.includes(tmp), `${f} names the output path`);
			assert.ok(!new RegExp(`/(Users|home)/${user}\\b`).test(text), `${f} names the user`);
		}
	});
});

describe('the vendored copies of nclite files', () => {
	for (const copy of COPIES) {
		const dir = path.join(ROOT, copy.dest);
		const sums = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8')) as Record<string, string>;
		const what = copy.take ? 'markdown' : 'contract';

		it(`the vendored ${what} holds exactly the files its manifest lists, each matching its sha256`, () => {
			assert.deepEqual(filesIn(dir).filter((f) => f !== MANIFEST).sort(), Object.keys(sums).sort());
			for (const [f, sum] of Object.entries(sums)) assert.equal(sha256(fs.readFileSync(path.join(dir, f))), sum, f);
		});

		it(`the vendored ${what} holds no test files`, () => {
			assert.deepEqual(Object.keys(sums).filter((f) => f.endsWith('.test.ts')), []);
		});
	}
});

describe('the repo', () => {
	it('has no runtime dependency and exact-pinned dev dependencies', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
		assert.equal(pkg.dependencies, undefined);
		for (const v of Object.values(pkg.devDependencies) as string[]) assert.match(v, /^\d+\.\d+\.\d+$/);
	});

	it('ignores node_modules and dist', () => {
		const lines = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n');
		assert.ok(lines.includes('node_modules/') && lines.includes('dist/'));
	});
});
