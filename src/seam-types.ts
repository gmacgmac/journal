// The seam's types: the source of `plugin.d.ts` (bin/types.ts emits it after the contract's own declarations). This file may
// import the contract copy and nothing else; the import is left out of the emitted file.
// PLACEHOLDER: JR_02 and JR_03 replace the shapes below with the Journal's (docs/specification/plugin.md § The types).
import type { PluginEngine, PluginEngineOptions, PluginHost, PluginView } from './vendor/plugin-host/plugin-host.ts';

/** The view's one export: shows the Journal in `root`, on the host it is given. */
export declare function mount(root: HTMLElement, host: PluginHost): PluginView;

/** The engine's one export. */
export declare function createEngine(options: PluginEngineOptions): PluginEngine;

/** What the host gives `mount`. */
export interface MountContext {
	root: HTMLElement;
}

/** What `mount` hands back. */
export interface Mounted {
	unmount(): void;
}

/** What `createEngine` gives the host. */
export interface Engine {
	tools: { list(): unknown[] };
}
