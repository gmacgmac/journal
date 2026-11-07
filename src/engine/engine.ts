// The engine entry: one export, `createEngine` (docs/specification/plugin.md § The engine). It runs in nclite's jailed child,
// one per bot, over the data folder nclite makes (`.journal/` in the bot's workspace). Nothing is held in memory that the
// files do not say, so a restart loses nothing.
import type { PluginEngine, PluginEngineOptions } from '../vendor/plugin-host/plugin-host.ts';
import { createResolve } from './resolve.ts';
import { createRoutes } from './routes.ts';
import { createTools } from './tools/index.ts';
import { createWatch } from './watch.ts';

/** `clock` is for tests: the person's today, `YYYY-MM-DD`; the host's own local date when left out. */
export function createEngine(options: PluginEngineOptions, clock: { today?: () => string } = {}): PluginEngine {
	const { dir, warn } = options;
	const watcher = createWatch(dir, warn);
	const wrote = (date: string) => watcher.wrote(date);
	return {
		route: createRoutes(dir, wrote, warn),
		resolve: createResolve(dir, warn),
		tools: createTools(dir, wrote, warn, clock.today),
		watch: (onChange) => watcher.watch(onChange),
	};
}
