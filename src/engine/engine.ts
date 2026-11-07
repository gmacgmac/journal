// The engine entry: one export, `createEngine` (docs/specification/plugin.md § The engine). It runs in nclite's jailed child,
// one per bot, over the data folder nclite makes (`.journal/` in the bot's workspace). Nothing is held in memory that the
// files do not say, so a restart loses nothing.
import type { PluginEngine, PluginEngineOptions } from '../vendor/plugin-host/plugin-host.ts';
import { createResolve } from './resolve.ts';
import { createRoutes } from './routes.ts';
import { createWatch } from './watch.ts';

export function createEngine(options: PluginEngineOptions): PluginEngine {
	const { dir, warn } = options;
	const watcher = createWatch(dir, warn);
	return {
		route: createRoutes(dir, (date) => watcher.wrote(date), warn),
		resolve: createResolve(dir, warn),
		// The bot's tools are JR_05's (docs/specification/plugin.md § Tools).
		tools: { list: () => [], call: async () => ({ content: [], isError: true }) },
		watch: (onChange) => watcher.watch(onChange),
	};
}
