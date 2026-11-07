// BEFORE THE VIEW GOES (spec § The view, `unsaved()` and `leave()`). The host asks `leave()` before it unmounts, and waits
// at most the contract's `VIEW_ANSWER_MS` for an answer or for the pane's confirm to open. So the Journal saves what is
// open, and when that save is refused, or slower than half that wait, it asks through `confirm` whether to discard the
// writing: it always answers, or asks, inside the host's wait, and never loses words without the person's yes.
import { VIEW_ANSWER_MS, type PluginHost } from '../vendor/plugin-host/plugin-host.ts';
import type { Page } from './session.ts';
import { say } from './words.ts';

/** How long `leave()` waits for its save before it asks. */
export const LEAVE_SAVE_MS = VIEW_ANSWER_MS / 2;

const SLOW = Symbol('slow');

export interface Leave {
	unsaved(): boolean;
	leave(): Promise<boolean>;
}

/** `live.on` is false once the view is unmounted: whatever answers after that changes nothing. */
export function createLeave(page: Page, confirm: PluginHost['confirm'], live: { readonly on: boolean }): Leave {
	let asking: Promise<boolean> | null = null;

	/** An open writing session whose words differ from what was saved, or are on their way. */
	function unsaved(): boolean {
		const s = page.sessions.current;
		if (s === null) return false;
		if (s.saving !== null) return true;
		const r = s.spec.read();
		return 'problem' in r || r.edit !== null;
	}

	async function saveOrAsk(): Promise<boolean> {
		const s = page.sessions.current!;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const slow = new Promise<typeof SLOW>((done) => (timer = setTimeout(() => done(SLOW), LEAVE_SAVE_MS)));
		const outcome = await Promise.race([s.finish({ then: 'stay' }), slow]);
		clearTimeout(timer);
		if (!live.on || (outcome === null && !unsaved())) return true;
		const body = outcome === SLOW || outcome === null ? say('journal.view.leave.slow') : outcome;
		const discard = await confirm({ heading: say('journal.view.leave.heading'), body, confirm: say('journal.view.leave.confirm') });
		if (!live.on) return discard;
		const open = page.sessions.current;
		if (discard) open?.discard();
		else open?.focus();
		return discard;
	}

	return {
		unsaved,
		leave() {
			if (asking !== null) return asking;
			if (!unsaved()) return Promise.resolve(true);
			asking = saveOrAsk().finally(() => (asking = null));
			return asking;
		},
	};
}
