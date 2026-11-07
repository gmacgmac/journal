// The view entry: one export, `mount`. PLACEHOLDER until JR_03.
import type { MountContext, Mounted } from '../seam-types.ts';
import './journal.css';

export function mount(context: MountContext): Mounted {
	const note = document.createElement('p');
	note.className = 'journal';
	note.textContent = 'Journal';
	context.root.append(note);
	return { unmount: () => note.remove() };
}
