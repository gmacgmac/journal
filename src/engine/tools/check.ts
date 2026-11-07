// The engine checks every tool input against its schema itself (nclite passes it through unread). Only the parts of JSON
// Schema the five tools use: an object of known properties, required ones, and per property its type (`string`, `integer`,
// or a list of them with `null`), `pattern`, `minLength`, `maxLength` and `minimum`. Lengths count code points, as JSON
// Schema does.

type Schema = { readonly [keyword: string]: unknown };

const typeOf = (v: unknown): string => (v === null ? 'null' : Number.isSafeInteger(v) ? 'integer' : typeof v);

function fits(schema: Schema, value: unknown): boolean {
	const types = ([] as unknown[]).concat(schema.type ?? []);
	if (types.length > 0 && !types.includes(typeOf(value))) return false;
	if (typeof value === 'string') {
		const n = [...value].length;
		if (typeof schema.minLength === 'number' && n < schema.minLength) return false;
		if (typeof schema.maxLength === 'number' && n > schema.maxLength) return false;
		if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) return false;
	}
	if (typeof value === 'number' && typeof schema.minimum === 'number' && value < schema.minimum) return false;
	return true;
}

/** The first field of `input` that does not fit `schema` (missing, unknown or of the wrong form); null when all fit. */
export function badField(schema: Schema, input: unknown): string | null {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'input';
	const properties = (schema.properties ?? {}) as Record<string, Schema>;
	const required = (schema.required ?? []) as string[];
	const given = input as Record<string, unknown>;
	for (const [name, part] of Object.entries(properties)) {
		if (!Object.hasOwn(given, name) || given[name] === undefined) {
			if (required.includes(name)) return name;
		} else if (!fits(part, given[name])) return name;
	}
	return Object.keys(given).find((name) => !Object.hasOwn(properties, name)) ?? null;
}
