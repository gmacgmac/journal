// The package's one way to make an element: a tag, its attributes, and its children. Kept here so nothing is imported.
export function h<K extends keyof HTMLElementTagNameMap>(
	tag: K, attrs: Record<string, string> = {}, children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	node.append(...children);
	return node;
}
