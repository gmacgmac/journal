// The Journal's few icons, flat strokes in the text's own colour (`currentColor`), drawn here so the view loads nothing
// and owes no one a licence. Each is a 24-unit square; the CSS sizes it to the text it sits in (`.icon`). An icon is
// always beside words or inside a button that carries an `aria-label`, so the drawing itself is hidden from readers.
const SVG = 'http://www.w3.org/2000/svg';

/** Each icon's strokes: path data, or a rectangle as `rect:x,y,w,h,r`. */
const ICONS = {
	plus: ['M12 5v14', 'M5 12h14'],
	link: ['M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5'],
	todo: ['rect:4,4,16,16,3', 'M8.5 12.5l2.5 2.5 4.5-5'],
	send: ['M20.5 3.5L3.5 10.5l7 2.5 2.5 7 7.5-16.5z', 'M10.5 13l4.5-4.5'],
	trash: ['M4 7h16', 'M9 7V4.5h6V7', 'M6 7l1 13h10l1-13', 'M10 11v5.5', 'M14 11v5.5'],
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
	const svg = document.createElementNS(SVG, 'svg');
	for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
	for (const stroke of ICONS[name]) {
		if (stroke.startsWith('rect:')) {
			const [x, y, width, height, rx] = stroke.slice(5).split(',');
			const rect = document.createElementNS(SVG, 'rect');
			for (const [k, v] of Object.entries({ x: x!, y: y!, width: width!, height: height!, rx: rx! })) rect.setAttribute(k, v);
			svg.append(rect);
		} else {
			const path = document.createElementNS(SVG, 'path');
			path.setAttribute('d', stroke);
			svg.append(path);
		}
	}
	return svg;
}
