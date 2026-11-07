// The view entry: one export, `mount`, and one stylesheet. This file is the adapter between whoever shows the
// Journal and the view's own `JournalApp` (`app.ts`): today it hands the proof's `app` shape straight through; the
// host rewiring (JR_04) makes it turn nclite's host into a `JournalApp` here, and nowhere else.
import type { JournalApp, JournalView } from './app.ts';
import { mountJournal } from './journal.ts';
import './journal.css';

export function mount(root: HTMLElement, app: JournalApp): JournalView {
	return mountJournal(root, app);
}
