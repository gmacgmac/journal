// The bot's tools (docs/specification/plugin.md § Tools), the engine's `tools`: five tools in MCP's shapes, each input checked
// against its own schema here (nclite passes it through unread), every refusal a result and never a throw. The caller is
// the bot; the Journal records nothing of it.
import type { EngineTools, ToolResult } from '../../vendor/plugin-host/plugin-host.ts';
import { word } from '../words.ts';
import { badField } from './check.ts';
import { readDaysTool } from './read.ts';
import { named, refused } from './result.ts';
import { TOOL_NAMES, listedTools, type ToolName } from './schemas.ts';
import { addEntry, changeBlock, type AnchorInput, type EntryInput } from './write.ts';

export { READ_MAX_CHARS, READ_MAX_DAYS, TOOL_NAMES, listedTools, toolDecls, type ToolName } from './schemas.ts';

const isTool = (name: string): name is ToolName => (TOOL_NAMES as readonly string[]).includes(name);

/** The tools over the data folder `dir`. `wrote` hears each day a tool saved, at once, as the routes' writes are heard. */
export function createTools(dir: string, wrote: (date: string) => void, warn: (message: string) => void): EngineTools {
	const listed = listedTools();
	const schemas = new Map(listed.map((t) => [t.name, t.inputSchema]));
	const run = (name: ToolName, input: Record<string, unknown>): ToolResult => {
		switch (name) {
			case 'read_days': return readDaysTool(dir, input as { from: string; to?: string });
			case 'add_entry': return addEntry(dir, input as unknown as EntryInput, wrote);
			case 'replace_block': return changeBlock(dir, 'replace', input as unknown as AnchorInput & { text: string }, wrote);
			case 'delete_block': return changeBlock(dir, 'delete', input as unknown as AnchorInput, wrote);
			case 'insert_after': return changeBlock(dir, 'insert', input as unknown as AnchorInput & { text: string }, wrote);
		}
	};
	return {
		list: () => listed,
		instructions: word('journal.tool.instructions'),
		call: async (name, input) => {
			if (typeof name !== 'string' || !isTool(name)) return refused('tool', { name: named(String(name)) });
			const bad = badField(schemas.get(name)!, input);
			if (bad !== null) return refused('input', { field: named(bad) });
			try {
				return run(name, input);
			} catch (e) {
				warn(`journal: ${name} failed: ${(e as Error).message}`);
				return refused('failed');
			}
		},
	};
}
