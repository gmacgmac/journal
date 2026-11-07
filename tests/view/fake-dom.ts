// A small fake DOM, just enough for the view's code that runs without a browser: building elements, moving them,
// data attributes, classes, the simple selectors the view uses (a compound like `.block[data-key="k"]:not(.draft)`,
// a `:scope > ` prefix, a comma list) and bubbling events. Not a browser: caret, focus and layout are not modelled.
// `installDom()` puts `document`, `Node` and `window` on `globalThis` for one test file.
// The selection is always empty and a range does nothing, which is enough to open a writing session and read it back:
// where the caret lands is the browser walk's to prove.

type Listener = { fn: (e: FakeEvent) => void; once?: boolean };

export class FakeEvent {
	type: string;
	target: FakeNode | null = null;
	defaultPrevented = false;
	cancelBubble = false;
	[k: string]: unknown;
	constructor(type: string, init: Record<string, unknown> = {}) {
		this.type = type;
		Object.assign(this, init);
	}
	preventDefault(): void { this.defaultPrevented = true; }
	stopPropagation(): void { this.cancelBubble = true; }
}

export class FakeNode {
	static ELEMENT_NODE = 1;
	static TEXT_NODE = 3;
	nodeType = 0;
	parentNode: FakeElement | null = null;
	childNodes: FakeNode[] = [];
	listeners = new Map<string, Set<Listener>>();

	get parentElement(): FakeElement | null { return this.parentNode; }
	get textContent(): string { return this.childNodes.map((c) => c.textContent).join(''); }
	set textContent(t: string) { this.replaceChildren(...(t === '' ? [] : [t])); }
	get isConnected(): boolean {
		let n: FakeNode = this;
		while (n.parentNode !== null) n = n.parentNode;
		return n === doc.documentElement;
	}
	get siblings(): FakeNode[] { return this.parentNode?.childNodes ?? []; }
	get nextElementSibling(): FakeElement | null {
		const s = this.siblings;
		return s.slice(s.indexOf(this) + 1).find(isEl) ?? null;
	}
	get previousElementSibling(): FakeElement | null {
		const s = this.siblings;
		return s.slice(0, s.indexOf(this)).reverse().find(isEl) ?? null;
	}
	get children(): FakeElement[] { return this.childNodes.filter(isEl); }
	get firstElementChild(): FakeElement | null { return this.children[0] ?? null; }

	contains(n: unknown): boolean {
		for (let x = n as FakeNode | null; x instanceof FakeNode; x = x.parentNode) if (x === this) return true;
		return false;
	}
	remove(): void {
		const p = this.parentNode;
		if (p !== null) p.childNodes.splice(p.childNodes.indexOf(this), 1);
		this.parentNode = null;
	}
	insertBefore(node: FakeNode, ref: FakeNode | null): FakeNode {
		for (const n of adopt([node])) {
			n.remove();
			n.parentNode = this as unknown as FakeElement;
			const at = ref === null ? -1 : this.childNodes.indexOf(ref);
			if (at < 0) this.childNodes.push(n);
			else this.childNodes.splice(at, 0, n);
		}
		return node;
	}
	append(...nodes: (FakeNode | string)[]): void { for (const n of adopt(nodes)) this.insertBefore(n, null); }
	appendChild(n: FakeNode): FakeNode { return this.insertBefore(n, null); }
	prepend(...nodes: (FakeNode | string)[]): void {
		const first = this.childNodes[0] ?? null;
		for (const n of adopt(nodes)) this.insertBefore(n, first);
	}
	replaceChildren(...nodes: (FakeNode | string)[]): void {
		const kept = adopt(nodes);
		for (const c of [...this.childNodes]) c.remove();
		for (const n of kept) this.insertBefore(n, null);
	}
	before(...nodes: (FakeNode | string)[]): void { for (const n of adopt(nodes)) this.parentNode?.insertBefore(n, this); }
	after(...nodes: (FakeNode | string)[]): void {
		const p = this.parentNode;
		if (p === null) return;
		const ref = this.siblings[this.siblings.indexOf(this) + 1] ?? null;
		for (const n of adopt(nodes)) p.insertBefore(n, ref);
	}
	replaceWith(...nodes: (FakeNode | string)[]): void {
		this.before(...nodes);
		this.remove();
	}
	cloneNode(_deep = false): FakeNode { throw new Error('abstract'); }

	addEventListener(type: string, fn: (e: FakeEvent) => void, opts?: { signal?: AbortSignal; once?: boolean }): void {
		const l: Listener = { fn, once: opts?.once };
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type)!.add(l);
		opts?.signal?.addEventListener('abort', () => this.listeners.get(type)?.delete(l));
	}
	removeEventListener(type: string, fn: (e: FakeEvent) => void): void {
		for (const l of this.listeners.get(type) ?? []) if (l.fn === fn) this.listeners.get(type)!.delete(l);
	}
	listenerCount(): number { return [...this.listeners.values()].reduce((n, s) => n + s.size, 0); }
	dispatchEvent(e: FakeEvent): boolean {
		e.target ??= this;
		for (let n: FakeNode | null = this; n !== null && !e.cancelBubble; n = n.parentNode) {
			for (const l of [...(n.listeners.get(e.type) ?? [])]) l.fn(e);
		}
		return !e.defaultPrevented;
	}
}

export class FakeText extends FakeNode {
	data: string;
	constructor(data: string) {
		super();
		this.nodeType = FakeNode.TEXT_NODE;
		this.data = data;
	}
	override get textContent(): string { return this.data; }
	override set textContent(t: string) { this.data = t; }
	override cloneNode(): FakeText { return new FakeText(this.data); }
}

const isEl = (n: FakeNode): n is FakeElement => n.nodeType === FakeNode.ELEMENT_NODE;
const adopt = (nodes: (FakeNode | string)[]): FakeNode[] => nodes.map((n) => (typeof n === 'string' ? new FakeText(n) : n));
const camelToData = (k: string) => `data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

export class FakeElement extends FakeNode {
	tagName: string;
	attrs = new Map<string, string>();
	style = { textAlign: '', props: new Map<string, string>(), setProperty(k: string, v: string) { this.props.set(k, v); } };
	value = '';
	offsetHeight = 0;
	onsubmit: ((e: FakeEvent) => void) | null = null;
	private checkedState: boolean | null = null;
	dataset: Record<string, string | undefined>;
	classList = {
		el: this as FakeElement,
		list(): string[] { return (this.el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean); },
		contains(c: string): boolean { return this.list().includes(c); },
		add(...cs: string[]): void { this.el.setAttribute('class', [...new Set([...this.list(), ...cs])].join(' ')); },
		remove(...cs: string[]): void { this.el.setAttribute('class', this.list().filter((c) => !cs.includes(c)).join(' ')); },
		toggle(c: string, force?: boolean): boolean {
			const on = force ?? !this.contains(c);
			if (on) this.add(c);
			else this.remove(c);
			return on;
		},
	};

	constructor(tag: string) {
		super();
		this.nodeType = FakeNode.ELEMENT_NODE;
		this.tagName = tag.toUpperCase();
		const el = this;
		this.dataset = new Proxy({}, {
			get: (_t, k) => (typeof k === 'string' ? el.getAttribute(camelToData(k)) ?? undefined : undefined),
			set: (_t, k, v) => (el.setAttribute(camelToData(String(k)), String(v)), true),
		});
	}

	setAttribute(k: string, v: string): void { this.attrs.set(k, String(v)); }
	getAttribute(k: string): string | null { return this.attrs.get(k) ?? null; }
	hasAttribute(k: string): boolean { return this.attrs.has(k); }
	removeAttribute(k: string): void { this.attrs.delete(k); }
	get id(): string { return this.getAttribute('id') ?? ''; }
	get className(): string { return this.getAttribute('class') ?? ''; }
	set className(v: string) { this.setAttribute('class', v); }
	get hidden(): boolean { return this.hasAttribute('hidden'); }
	set hidden(on: boolean) { if (on) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
	get checked(): boolean { return this.checkedState ?? this.hasAttribute('checked'); }
	set checked(on: boolean) { this.checkedState = on; }
	get start(): number { return Number(this.getAttribute('start') ?? 1); }
	set contentEditable(v: string) { this.setAttribute('contenteditable', v); }
	get isContentEditable(): boolean {
		for (let n: FakeElement | null = this; n !== null; n = n.parentNode) {
			const v = n.getAttribute('contenteditable');
			if (v !== null) return v === 'true';
		}
		return false;
	}
	focus(): void { doc.activeElement = this; }
	scrollIntoView(): void {}
	override cloneNode(deep = false): FakeElement {
		const c = new FakeElement(this.tagName);
		for (const [k, v] of this.attrs) c.setAttribute(k, v);
		c.checkedState = this.checkedState;
		if (deep) for (const n of this.childNodes) c.appendChild(n.cloneNode(true));
		return c;
	}

	matches(selector: string): boolean { return selectorList(selector).some((s) => matchCompound(this, s.compound)); }
	closest(selector: string): FakeElement | null {
		for (let n: FakeElement | null = this; n !== null; n = n.parentNode) if (n.matches(selector)) return n;
		return null;
	}
	querySelectorAll(selector: string): FakeElement[] {
		const list = selectorList(selector);
		const out: FakeElement[] = [];
		const walk = (n: FakeElement) => {
			for (const c of n.children) {
				if (list.some((s) => (!s.child || c.parentNode === this) && matchCompound(c, s.compound))) out.push(c);
				walk(c);
			}
		};
		walk(this);
		return out;
	}
	querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null; }
}

/** One compound selector: a tag, classes, attributes (`[k]`, `[k=v]`, `[k="v"]`), `:not(…)`, `:last-child`. */
type Compound = { tag?: string; classes: string[]; attrs: [string, string | null][]; not: Compound[]; lastChild: boolean };

function parseCompound(src: string): Compound {
	const c: Compound = { classes: [], attrs: [], not: [], lastChild: false };
	const re = /^([a-zA-Z][\w-]*|\*)|\.([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]|:not\(([^)]*)\)|:last-child/g;
	let m: RegExpExecArray | null;
	let at = 0;
	while ((m = re.exec(src)) !== null && m.index === at) {
		at = re.lastIndex;
		if (m[1] !== undefined) c.tag = m[1] === '*' ? undefined : m[1].toUpperCase();
		else if (m[2] !== undefined) c.classes.push(m[2]);
		else if (m[3] !== undefined) c.attrs.push([m[3], m[4] ?? m[5] ?? m[6] ?? null]);
		else if (m[7] !== undefined) c.not.push(parseCompound(m[7].trim()));
		else c.lastChild = true;
	}
	if (at !== src.length) throw new Error(`fake-dom: selector not supported: ${src}`);
	return c;
}

function selectorList(selector: string): { child: boolean; compound: Compound }[] {
	return selector.split(',').map((part) => {
		const s = part.trim();
		const m = /^:scope\s*>\s*(.+)$/.exec(s);
		return { child: m !== null, compound: parseCompound(m?.[1] ?? s) };
	});
}

function matchCompound(el: FakeElement, c: Compound): boolean {
	if (c.tag !== undefined && el.tagName !== c.tag) return false;
	if (!c.classes.every((k) => el.classList.contains(k))) return false;
	if (!c.attrs.every(([k, v]) => (v === null ? el.hasAttribute(k) : el.getAttribute(k) === v))) return false;
	if (c.lastChild && el.parentNode?.children.at(-1) !== el) return false;
	return !c.not.some((n) => matchCompound(el, n));
}

/** A range that holds nothing and does nothing. */
class FakeRange {
	startContainer: FakeNode | null = null;
	startOffset = 0;
	collapsed = true;
	setStart(): void {}
	setEnd(): void {}
	setStartBefore(): void {}
	collapse(): void {}
	selectNodeContents(): void {}
	cloneRange(): FakeRange { return new FakeRange(); }
	toString(): string { return ''; }
}

/** The page's selection, always empty. */
const fakeSelection = {
	rangeCount: 0,
	anchorNode: null,
	isCollapsed: true,
	removeAllRanges(): void {},
	addRange(): void {},
	getRangeAt(): FakeRange { return new FakeRange(); },
};

class FakeDocument {
	documentElement = new FakeElement('html');
	body = new FakeElement('body');
	activeElement: FakeElement | null = null;
	constructor() { this.documentElement.append(this.body); }
	createElement(tag: string): FakeElement { return new FakeElement(tag); }
	createTextNode(t: string): FakeText { return new FakeText(t); }
	createRange(): FakeRange { return new FakeRange(); }
	elementFromPoint(): null { return null; }
	/** Walks the text nodes under `root`, in order. */
	createTreeWalker(root: FakeNode): { nextNode(): FakeNode | null } {
		const texts: FakeNode[] = [];
		const walk = (n: FakeNode) => n.childNodes.forEach((c) => (c.nodeType === FakeNode.TEXT_NODE ? texts.push(c) : walk(c)));
		walk(root);
		let at = 0;
		return { nextNode: () => texts[at++] ?? null };
	}
}

let doc = new FakeDocument();

/** Put a fresh fake `document`, `Node` and `window` on `globalThis`; returns the document. */
export function installDom(): FakeDocument {
	doc = new FakeDocument();
	const g = globalThis as Record<string, unknown>;
	g.document = doc;
	g.Node = FakeNode;
	g.window = g;
	g.getSelection = () => fakeSelection;
	g.NodeFilter = { SHOW_TEXT: 4 };
	return doc;
}

/** A detached-free root for one mount: a <div> in the fake body. */
export function newRoot(): HTMLElement {
	const root = doc.createElement('div');
	doc.body.append(root);
	return root as unknown as HTMLElement;
}

/** Fire `type` at `target` (bubbling); returns the event. */
export function fire(target: unknown, type: string, init: Record<string, unknown> = {}): FakeEvent {
	const e = new FakeEvent(type, init);
	(target as FakeNode).dispatchEvent(e);
	return e;
}

/** Let pending promises settle. */
export const settle = () => new Promise((r) => setImmediate(r));
