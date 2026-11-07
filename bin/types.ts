// `plugin.d.ts`: the types a TypeScript host compiles against. The sources are the contract copy
// (`src/vendor/plugin-host/plugin-host.ts`, nclite's file) and `src/seam-types.ts`, which may import that one file and
// nothing else. Both are emitted by the repo's own TypeScript (declaration only, in memory), the contract first, so the
// seam's one import is left out of the output and the file names no other file. One module, no import.
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(import.meta.dirname, '../src');
const CONTRACT = path.join(SRC, 'vendor/plugin-host/plugin-host.ts');
const ENTRY = path.join(SRC, 'seam-types.ts');

const importsOf = (source: ts.SourceFile) =>
	source.statements.filter((s) => ts.isImportDeclaration(s) || ts.isExportDeclaration(s) || ts.isImportEqualsDeclaration(s));

/** The module an import names, as an absolute path, or `null` when it is not a relative file. */
const target = (s: ts.Statement, from: string): string | null => {
	const spec = ts.isImportDeclaration(s) || ts.isExportDeclaration(s) ? s.moduleSpecifier : undefined;
	return spec && ts.isStringLiteral(spec) && spec.text.startsWith('.') ? path.resolve(path.dirname(from), spec.text) : null;
};

export function pluginTypes(): string {
	const program = ts.createProgram([CONTRACT, ENTRY], {
		declaration: true, emitDeclarationOnly: true, strict: true, skipLibCheck: true, types: [], allowImportingTsExtensions: true,
		lib: ['lib.es2024.d.ts', 'lib.dom.d.ts'], target: ts.ScriptTarget.ES2024,
	});
	const contract = program.getSourceFile(CONTRACT);
	const entry = program.getSourceFile(ENTRY);
	if (!contract) throw new Error('plugin.d.ts: src/vendor/plugin-host/plugin-host.ts is missing (run npm run sync:nclite)');
	if (!entry) throw new Error('plugin.d.ts: src/seam-types.ts is missing');
	if (importsOf(contract).length) throw new Error('plugin.d.ts: the contract copy must import nothing');
	const stray = importsOf(entry).filter((s) => target(s, ENTRY) !== CONTRACT);
	if (stray.length) throw new Error('plugin.d.ts: src/seam-types.ts may import only the contract copy');
	const emitted = new Map<string, string>();
	const result = program.emit(undefined, (file, data) => { if (file.endsWith('.d.ts')) emitted.set(path.basename(file, '.d.ts'), data); }, undefined, true);
	const errors = [...ts.getPreEmitDiagnostics(program, contract), ...ts.getPreEmitDiagnostics(program, entry), ...result.diagnostics]
		.filter((d) => d.category === ts.DiagnosticCategory.Error);
	const head = emitted.get('plugin-host');
	let tail = emitted.get('seam-types');
	if (errors.length || head === undefined || tail === undefined) {
		throw new Error(`plugin.d.ts: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ') || 'nothing emitted'}`);
	}
	const d = ts.createSourceFile('seam-types.d.ts', tail, ts.ScriptTarget.ES2024);
	for (const s of importsOf(d).reverse()) tail = tail.slice(0, s.getFullStart()) + tail.slice(s.getEnd());
	return `${head.trimEnd()}\n\n${tail.trimStart()}`;
}
