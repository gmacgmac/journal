/**
 * THE PLUGIN CONTRACT, AS NCLITE HOLDS IT (journal-plugin DESIGN_01, R1; `docs/plugins.md` § The contract). What a host
 * gives a plugin's view and engine, what they give back, and every shape that crosses a process or is stored. nclite is
 * the source: a plugin built to it carries a byte-identical copy (the Journal's `src/vendor/plugin-host/plugin-host.ts`),
 * and its folder's `vendored.json` names this file's sha256, which a test in nclite compares. The board was built to its
 * own seam before this file existed and is adapted to it, never the other way round (`docs/plugins.md` § The board's adapter).
 *
 * IT IMPORTS NOTHING AND NAMES NO DOM-ONLY TYPE, so the engine (Node's types), the app (the DOM's) and a plugin's own build
 * all compile it. `mount` names `HTMLElement`, so a plugin's `plugin.d.ts` declares it; here it is {@link Mount}.
 *
 * IT NAMES NO PLUGIN. The literals are bounds, keys and examples, and none holds a space: `shared/` is read by the words
 * guard, and nothing here is a sentence anyone reads.
 *
 * A BREAKING CHANGE HERE moves every plugin's seam: a member taken out or renamed, one the host gives that now holds less, one
 * a plugin gives that is now required, a bound made tighter. A member the host gives in addition, or a bound made looser, is
 * not breaking (`docs/plugins.md` § The seam number).
 */

/* ── Bounded references ───────────────────────────────────────────────────────────────────────────────────────────── */

/** One value of a {@link Ref}: a short string, a safe integer, a boolean, or a short list of strings or safe integers. */
export type RefValue = string | number | boolean | readonly (string | number)[];

/**
 * A small flat object of the plugin's own keys: what an event says changed, what a change line or a sent chip reveals, what
 * a chip's answer acknowledges. The host checks every one against {@link REF_LIMITS} where it enters (`checkRef`, to be built)
 * and passes it on unread. `{}` is a catch-up: anything may have changed, read again.
 */
export type Ref = { readonly [key: string]: RefValue };

/** The bounds of a {@link Ref}. A value outside them is dropped where it enters, never trimmed. */
export const REF_LIMITS = {
	/** Its JSON, in UTF-16 code units. */
	maxChars: 4096,
	maxKeys: 16,
	/** A key: a lowercase letter, then letters and digits. */
	keyPattern: '^[a-z][A-Za-z0-9]{0,31}$',
	/** A string value, and each string in a list. */
	maxString: 256,
	/** Items in one list. */
	maxItems: 500,
} as const;

/* ── Chips ────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A reference the view stages for the person's next message. The host draws `label` and `detail`, keeps the rest unread, and
 * sends `kind` and `ref` back to the engine's {@link PluginEngine.resolve} as the message goes. `kind` is one the manifest's
 * `chips` declares; `plugin`, if given, is ignored: the host knows whose view it is.
 */
export interface Chip {
	readonly plugin?: string;
	readonly kind: string;
	/** The plugin's own JSON, at most {@link CHIP_LIMITS} `refChars` as JSON. */
	readonly ref: unknown;
	readonly label: string;
	readonly detail: string;
	readonly preview?: string;
}

/** What a chip says now: `where` it is, then its `text`, one block of the bot's message; `ack`, what its send acknowledges. */
export interface ChipText {
	where: string;
	/** '' when there is nothing to send for it: no block goes. */
	text: string;
	ack?: Ref;
}

/** Why a chip cannot go: a short code of the plugin's own (`gone`, `changed`, …) and the sentence the person reads. */
export interface ChipRefusal {
	refused: string;
	reason: string;
}

export type ResolveAnswer = ChipText | ChipRefusal;

/** The bounds of a chip and of its answer. A chip outside them is not staged; an answer outside them is `unreadable`. */
export const CHIP_LIMITS = {
	refChars: 4096,
	kindChars: 64,
	labelChars: 200,
	detailChars: 500,
	whereChars: 500,
	reasonChars: 500,
	refusedChars: 32,
	textChars: 100000,
	/** Chips one message resolves. */
	perMessage: 32,
} as const;

/* ── What the host gives the view ─────────────────────────────────────────────────────────────────────────────────── */

/** What the bot the chat talks to is doing: nothing, its turn running, or waiting for the person's yes. */
export type ChatWork = 'idle' | 'working' | 'asking';

/** What the view may read of the chat. `on` says when any of it changes and returns the unsubscribe. */
export interface ChatStatus {
	readonly now: ChatWork;
	/** The bot's id on this plugin (the `caller.agent` its tool calls carry). */
	readonly agent?: string | undefined;
	/** A Send waits for the bot's turn to end. nclite gives none: its chat takes a message while the bot works. */
	readonly held?: boolean | undefined;
	/** The chat holds something Send would carry. */
	readonly staged?: boolean | undefined;
	on(listener: () => void): () => void;
}

/**
 * The plugin's own record of a Send, called once, only after the message went. `acks`: every `ack` the resolve answers of this
 * plugin's chips that went carried, in the order staged ([] when none did, or nothing went); null only from a host with no chat.
 * Resolves null when recorded, else the problem's words.
 */
export type SendRecord = (acks: readonly Ref[] | null) => Promise<string | null>;

/** The host's chat: the only way a view reaches it. */
export interface PluginChat {
	/** Adds, replaces or removes (null) the chip under `key`. A chip that went is spent until its key's `ref` changes, by value. */
	attach(key: string, chip: Chip | null): void;
	/** The person asked for this chip (an Add to chat of the view's own): it is staged even when the same went before. */
	add(chip: Chip): void;
	/** Send to agent: what is staged, with no words of the person's; then `record`. Null once done, else the problem's words. */
	send(record: SendRecord): Promise<string | null>;
	readonly status: ChatStatus;
	/** Shows the chat's newest change line of this plugin whose `reveal` holds every key and value of `ref`. */
	reveal(ref: Ref): void;
	/** Whether there is such a line. */
	hasLine(ref: Ref): boolean;
}

/** The values the host sets for this plugin (its row's `viewSettings`); a key it does not set answers `undefined`. */
export interface PluginSettings {
	get(key: string): unknown;
	on(listener: () => void): () => void;
}

/** The viewer's conveniences, as strings, per bot and plugin. It may lose anything, whenever it likes. */
export interface PluginStore {
	get(key: string): string | null;
	set(key: string, value: string): void;
}

export interface ConfirmItem {
	ref: string;
	text: string;
}

export interface ConfirmList {
	items: readonly ConfirmItem[];
	skipped?: readonly ConfirmItem[];
}

/** A question asked on the pane before something is taken away. `confirm` is the confirming button's words. */
export interface ConfirmAsk {
	heading: string;
	body: string;
	confirm: string;
	list?: ConfirmList;
}

/** Calls the engine's own routes, as the person: `path` is relative to the plugin's prefix, with its query. */
export type Transport = (path: string, init: RequestInit) => Promise<Response>;

/** A change to the plugin's data, from anyone. A `ref` of `{}` is a catch-up (said when the stream opens and on a restart). */
export interface PluginEvent {
	plugin: string;
	ref: Ref;
}

/** What `mount` is given. The host gives every member; none is left to a default. */
export interface PluginHost {
	api: Transport;
	events(listener: (event: PluginEvent) => void): () => void;
	chat: PluginChat;
	settings: PluginSettings;
	notify(text: string, tone?: 'info' | 'error'): void;
	confirm(ask: ConfirmAsk): Promise<boolean>;
	store: PluginStore;
	/** The address a picture's path goes after (the engine's `image`). */
	imageRoute: string;
}

/** What `mount` gives back. Every call the host makes into it is guarded: a throw or a hang there is the plugin's alone. */
export interface PluginView {
	/** Removes every listener it added and empties `root`. Never asks: the host calls `leave()` first. */
	unmount(): void;
	/** Synchronous: the view holds the person's words not yet saved. */
	unsaved(): boolean;
	/** Saves or asks before words are lost: true when the view may be unmounted, false when the person kept it open. */
	leave(): Promise<boolean>;
	/** The chip for what is on show, for the pane header's Add to chat; null when nothing is. */
	pageChip(): Chip | null;
	/** Brings into view what a change line or a sent chip names. A ref it cannot show is said through `notify`, never thrown. */
	reveal(ref: Ref): void;
}

/** The view module's one export, with the DOM's element as `Root`. */
export type Mount<Root> = (root: Root, host: PluginHost) => PluginView;

/* ── What the host gives the engine, and what it gives back ───────────────────────────────────────────────────────── */

/** Who is calling, set by the host from the route, never from a request. A bot is always an agent with an id. */
export type Caller = { by: 'person' } | { by: 'agent'; agent: string };

/** Every call carries both: the host always vouches for a caller, and the signal ends with the request or the run. */
export interface EngineContext {
	caller: Caller;
	signal: AbortSignal;
}

/** One request to the plugin's own routes: `path` after its prefix (`days`), the query, and the parsed JSON body. */
export interface EngineRequest {
	method: string;
	path: string;
	query: URLSearchParams;
	body?: unknown;
}

/** An answer. A problem is `{ title, status, … }` with `status` equal to the reply's; the host drops every header but `Allow`. */
export interface EngineReply {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}

/** One tool as MCP's `tools/list` sends it. */
export interface ListedTool {
	readonly name: string;
	readonly title?: string;
	readonly description: string;
	readonly inputSchema: { readonly [keyword: string]: unknown };
	readonly annotations?: { readonly [hint: string]: boolean };
}

/** MCP's `CallToolResult`, text content only. A refusal is `isError: true`, never a throw. `_meta` may carry {@link CHANGE_META}. */
export interface ToolResult {
	content: { type: 'text'; text: string }[];
	structuredContent?: unknown;
	isError: boolean;
	_meta?: Record<string, unknown>;
}

export interface EngineTools {
	list(): readonly ListedTool[];
	call(name: string, input: Record<string, unknown>, ctx: EngineContext): Promise<ToolResult>;
	/** What nclite's MCP server tells the bot before its first call. */
	readonly instructions?: string;
}

/** What `createEngine` gives back. It runs in a jailed child, one per bot; every value it sends is checked by the host. */
export interface PluginEngine {
	route(req: EngineRequest, ctx: EngineContext): Promise<EngineReply | null>;
	/** A picture under the data folder, for `imageRoute`; left out, every picture is a 404. */
	image?(req: { method: string; path: string }): EngineReply | Promise<EngineReply>;
	/** What a chip says now, or why it cannot go. Every `ref` shape the plugin ever made is answered or refused, never thrown at. */
	resolve(kind: string, ref: unknown): ResolveAnswer | Promise<ResolveAnswer>;
	readonly tools: EngineTools;
	/** Every change to the data, from anyone (another writer on the folder included). Returns the stop. */
	watch(onChange: (ref: Ref) => void): () => void;
}

/** What the host gives `createEngine`, every member. `flags` are the plugin row's `engineFlags`. */
export interface PluginEngineOptions {
	/** The data folder's real path: the only place the engine writes. */
	dir: string;
	/** The bot's name, for anything the plugin shows in place of `dir`. */
	name: () => string;
	/** A line for the engine's log. */
	warn: (message: string) => void;
	flags: Readonly<Record<string, boolean>>;
}

/** The engine module's one export. */
export type CreateEngine = (options: PluginEngineOptions) => PluginEngine;

/* ── The manifest ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface ToolDecl {
	name: string;
	/** The words key of its description. */
	words: string;
	/** JSON Schema; the engine checks every input against it itself. */
	input: { type: string; [keyword: string]: unknown };
	writes: boolean;
}

export interface ChipDecl {
	kind: string;
	words: string;
}

export type SettingDecl =
	| { key: string; type: 'choice'; options: string[]; default: string; words: string }
	| { key: string; type: 'switch'; default: boolean; words: string };

/** `manifest.json`, read before anything of the plugin loads. Text is always a words key of `words`, never the text. */
export interface PluginManifest {
	id: string;
	name: string;
	version: string;
	seam: number;
	/** A name from the app's own icon list; one the app lacks draws its plugin glyph. */
	icon?: string;
	view: { module: string; styles: string[]; export: string };
	engine: { module: string; export: string };
	chips: ChipDecl[];
	tools: ToolDecl[];
	settings?: SettingDecl[];
	skill: string;
	words: string;
	/** The words keys a change line may name (see {@link ChangeMeta}), each starting `<id>.`. */
	changeWords?: string[];
}

/** The most bytes a `skill.md` may hold unless the plugin's row grants more: it rides every turn while the plugin is on. */
export const SKILL_BYTES = 8192;

/** A file of the plugin folder: the sha256 of each nclite source file the plugin carries a copy of, by its path in nclite. */
export const VENDORED_FILE = 'vendored.json';
export type Vendored = Readonly<Record<string, string>>;

/* ── The change line ──────────────────────────────────────────────────────────────────────────────────────────────── */

/** The `_meta` key of a tool result that names what the call changed. */
export const CHANGE_META = 'nclite/change';

/**
 * What a write says it changed, under {@link CHANGE_META}: a words key of the plugin's (one its manifest's `changeWords`
 * lists), whose text may hold `{count}` and `{subject}`; the count; the subject (a date, a title); and what a click reveals.
 */
export interface ChangeMeta {
	words: string;
	count: number;
	subject: string;
	reveal?: Ref;
}

/** The `plugin_change` event body the engine stores for a {@link ChangeMeta}: `v` first, then `plugin`, then the meta's own. */
export interface StoredChange {
	v: 2;
	plugin: string;
	words: string;
	count: number;
	subject: string;
	reveal?: Ref;
}

/** The bounds of a change. A meta outside them records nothing. */
export const CHANGE_LIMITS = {
	/** A whole number from 0. */
	maxCount: 1000000,
	/** No control character (U+0000 to U+001F, U+007F). */
	subjectChars: 120,
} as const;

/**
 * THE CONTRACT'S WORKED EXAMPLE, the fixture both halves test against (R8): a plugin `example` whose manifest's `changeWords` is
 * `['example.change.edited']` writes {@link CHANGE_EXAMPLES} `meta`; the engine stores exactly `stored`; each of `none`
 * stores nothing.
 */
export const CHANGE_EXAMPLES = {
	meta: { [CHANGE_META]: { words: 'example.change.edited', count: 2, subject: 'plans', reveal: { date: '2026-11-07', key: 'a1b2c3d4-0' } } },
	stored: '{"v":2,"plugin":"example","words":"example.change.edited","count":2,"subject":"plans","reveal":{"date":"2026-11-07","key":"a1b2c3d4-0"}}',
	none: [
		{},
		{ [CHANGE_META]: 'edited' },
		{ [CHANGE_META]: { words: 'other.change.edited', count: 1, subject: 'plans' } },
		{ [CHANGE_META]: { words: 'example.change.unlisted', count: 1, subject: 'plans' } },
		{ [CHANGE_META]: { words: 'example.change.edited', count: -1, subject: 'plans' } },
		{ [CHANGE_META]: { words: 'example.change.edited', count: 1.5, subject: 'plans' } },
		{ [CHANGE_META]: { words: 'example.change.edited', count: 1, subject: 'x'.repeat(121) } },
		{ [CHANGE_META]: { words: 'example.change.edited', count: 1, subject: 'plans\u0007' } },
		{ [CHANGE_META]: { words: 'example.change.edited', count: 1, subject: 'plans', reveal: { Date: '2026-11-07' } } },
	],
} as const;

/* ── Host styling ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Every custom property a host may set for a plugin to read, on the view's root or above it, each a finished value for the
 * mode the root is in. A plugin reads these and its own `--<scope>-*`, and declares none of these. The meaning of each, its
 * contrast tier and its default are the board spec's § Theme and host styling, which this list follows.
 */
export const HOST_PROPERTIES = [
	'--host-font',
	'--host-font-mono',
	'--host-text-scale',
	'--host-accent',
	'--host-accent-strong',
	'--host-accent-fill',
	'--host-accent-fill-hover',
	'--host-on-accent',
	'--host-canvas',
	'--host-surface',
	'--host-surface-sunken',
	'--host-ink',
	'--host-ink-muted',
	'--host-line',
	'--host-line-strong',
	'--host-focus',
	'--host-color-scheme',
] as const;

export type HostProperty = (typeof HOST_PROPERTIES)[number];
