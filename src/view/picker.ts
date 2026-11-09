// The browser's own date picker, opened from a button: a date field laid over the button, not seen and not in the tab
// order, whose picker the button opens (`showPicker`). The button carries the words and the focus; the field only says
// which day was picked. Where `showPicker` is missing or refused, the field is shown and focused instead.
import { el } from './render.ts';

export interface PickerBounds {
	value: string;
	min?: string;
	max?: string;
}

/** A date field for a picker button, with its own accessible name. */
export function dateField(label: string, attrs: Record<string, string> = {}): HTMLInputElement {
	return el('input', [], { type: 'date', class: 'picker', tabindex: '-1', 'aria-label': label, ...attrs });
}

/** Opens `field`'s picker on `bounds`. */
export function openPicker(field: HTMLInputElement, bounds: PickerBounds): void {
	field.value = bounds.value;
	for (const bound of ['min', 'max'] as const) {
		const value = bounds[bound];
		if (value === undefined) field.removeAttribute(bound);
		else field.setAttribute(bound, value);
	}
	try {
		field.showPicker();
	} catch {
		field.classList.add('shown');
		field.focus();
	}
}
