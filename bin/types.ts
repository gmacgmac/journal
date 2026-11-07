// `plugin.d.ts`: the seam's types for a TypeScript host. The source is `src/seam-types.ts`, which imports nothing; its
// declarations are emitted by the repo's own TypeScript (declaration only, in memory), so there is no second copy and
// the file names no other file. A source that imports anything stops the build.
import path from 'node:path';
import ts from 'typescript';

const ENTRY = path.resolve(import.meta.dirname, '../src/seam-types.ts');

export function pluginTypes(): string {
	const program = ts.createProgram([ENTRY], {
		declaration: true, emitDeclarationOnly: true, strict: true, skipLibCheck: true, types: [],
		lib: ['lib.es2024.d.ts', 'lib.dom.d.ts'], target: ts.ScriptTarget.ES2024,
	});
	const source = program.getSourceFile(ENTRY);
	if (!source) throw new Error('plugin.d.ts: src/seam-types.ts is missing');
	if (source.statements.some((s) => ts.isImportDeclaration(s) || ts.isExportDeclaration(s) || ts.isImportEqualsDeclaration(s))) {
		throw new Error('plugin.d.ts: src/seam-types.ts must import nothing');
	}
	let text: string | undefined;
	const result = program.emit(source, (file, data) => { if (file.endsWith('.d.ts')) text = data; }, undefined, true);
	const errors = [...ts.getPreEmitDiagnostics(program, source), ...result.diagnostics].filter((d) => d.category === ts.DiagnosticCategory.Error);
	if (errors.length || text === undefined) {
		throw new Error(`plugin.d.ts: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ') || 'nothing emitted'}`);
	}
	return text;
}
