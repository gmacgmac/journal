// Test helpers for the Journal's colours: APCA-W3 0.0.98G-4g contrast, CSS `color-mix(in oklab, …)`, and an evaluator
// that works a stylesheet token out to one colour for a host and a mode, the way a browser does: `var()` with its
// fallback, `light-dark()`, `color-mix()`, hex. A `var()` of a property that is unset with no fallback makes the value
// invalid (null), and an invalid custom property falls back where it is read.

export type Rgb = readonly [number, number, number];
export type Mode = 'light' | 'dark';
/** What a host sets, by property, as one finished colour per mode. */
export type Host = Readonly<Record<string, { light: string; dark: string }>>;

export function hex(text: string): Rgb {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
	if (m === null) throw new Error(`not a hex colour: ${text}`);
	const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
}

/* ── APCA-W3 0.0.98G-4g ─────────────────────────────────────────────────────────────────────────────────────────── */

const luminance = ([r, g, b]: Rgb) => 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
const clampBlack = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);

/** The APCA lightness contrast of `text` on `ground`: positive for dark on light, negative for light on dark. */
export function apcaLc(text: Rgb, ground: Rgb): number {
	const t = clampBlack(luminance(text));
	const g = clampBlack(luminance(ground));
	if (Math.abs(g - t) < 0.0005) return 0;
	if (g > t) {
		const sapc = (g ** 0.56 - t ** 0.57) * 1.14;
		return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
	}
	const sapc = (g ** 0.65 - t ** 0.62) * 1.14;
	return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/* ── color-mix(in oklab, …) ─────────────────────────────────────────────────────────────────────────────────────── */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklab(rgb: Rgb): [number, number, number] {
	const [r, g, b] = rgb.map((c) => toLinear(c / 255)) as [number, number, number];
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function fromOklab([L, a, b]: [number, number, number]): Rgb {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const lin = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
	return lin.map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)) as unknown as Rgb;
}

/** `color-mix(in oklab, a p%, b q%)`, the two percentages taken as weights. */
export function mixOklab(a: Rgb, p: number, b: Rgb, q: number): Rgb {
	const [x, y] = [oklab(a), oklab(b)];
	const w = p / (p + q);
	return fromOklab([0, 1, 2].map((i) => x[i]! * w + y[i]! * (1 - w)) as [number, number, number]);
}

/* ── Working a token out ────────────────────────────────────────────────────────────────────────────────────────── */

/** `inner` split on its top-level commas. */
function args(inner: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < inner.length; i += 1) {
		if (inner[i] === '(') depth += 1;
		else if (inner[i] === ')') depth -= 1;
		else if (inner[i] === ',' && depth === 0) {
			out.push(inner.slice(start, i).trim());
			start = i + 1;
		}
	}
	return [...out, inner.slice(start).trim()];
}

/** The custom properties a rule's block declares, by name, as written (the first block whose selector is `selector`). */
export function declared(css: string, selector: string): Map<string, string> {
	const at = css.indexOf(`${selector} {`);
	if (at < 0) throw new Error(`no ${selector} block`);
	const block = css.slice(at);
	return new Map([...block.matchAll(/^\t(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1]!, m[2]!.trim()]));
}

/** `expr` worked out to one colour for `host` in `mode`; null when it is invalid (an unset property with no fallback). */
export function evaluate(expr: string, tokens: ReadonlyMap<string, string>, host: Host, mode: Mode): Rgb | null {
	const e = expr.trim();
	const call = /^([a-z-]+)\(([\s\S]*)\)$/.exec(e);
	if (call === null) return hex(e);
	const [name, inner] = [call[1]!, call[2]!];
	const parts = args(inner);
	if (name === 'light-dark') return evaluate(parts[mode === 'light' ? 0 : 1]!, tokens, host, mode);
	if (name === 'var') {
		const [prop, ...rest] = parts;
		const fallback = rest.length > 0 ? rest.join(', ') : null;
		const set = host[prop!]?.[mode] ?? tokens.get(prop!);
		const value = set === undefined ? null : evaluate(set, tokens, host, mode);
		return value ?? (fallback === null ? null : evaluate(fallback, tokens, host, mode));
	}
	if (name === 'color-mix') {
		const [space, a, b] = parts;
		if (space !== 'in oklab') throw new Error(`mix space: ${space}`);
		const side = (s: string) => {
			const m = /^([\s\S]+)\s+(\d+(?:\.\d+)?)%$/.exec(s)!;
			return [evaluate(m[1]!, tokens, host, mode), Number(m[2])] as const;
		};
		const [[x, p], [y, q]] = [side(a!), side(b!)];
		return x === null || y === null ? null : mixOklab(x, p, y, q);
	}
	throw new Error(`cannot work out ${name}()`);
}
