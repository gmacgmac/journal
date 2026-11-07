// EVERY SENTENCE THE VIEW SHOWS, BY ITS WORDS KEY (spec § Words, `journal.view.*`). The view's code names keys, never
// text, so this table is the one place its words live.
// STAGING: the keys belong in `words/words.json` (JR_05's). Once they are there, this file reads that file instead of
// holding the table, and nothing else in the view changes.

const VIEW_WORDS = {
	'journal.view.range.label': 'Days shown',
	'journal.view.range.earlier': 'Earlier days',
	'journal.view.range.later': 'Later days',
	'journal.view.range.thisWeek': 'This week',
	'journal.view.range.from': 'From',
	'journal.view.range.to': 'To',
	'journal.view.bar.label': 'Writing',
	'journal.view.bar.bold': 'Bold',
	'journal.view.bar.boldHint': 'Bold  ⌘B',
	'journal.view.bar.italic': 'Italic',
	'journal.view.bar.italicHint': 'Italic  ⌘I',
	'journal.view.bar.link': 'Link',
	'journal.view.bar.linkHint': 'Link  ⌘K',
	'journal.view.bar.todo': 'To-do',
	'journal.view.bar.todoHint': 'To-do  (or type [] and a space)',
	'journal.view.bar.title': 'Add title',
	'journal.view.bar.ask': 'Add to chat',
	'journal.view.bar.remove': 'Delete',
	'journal.view.bar.done': 'Done',
	'journal.view.bar.doneHint': 'Done  Esc',
	'journal.view.bar.linkTo': 'Link to',
	'journal.view.bar.addLink': 'Add link',
	'journal.view.bar.cancel': 'Cancel',
	'journal.view.hint': 'Press Enter to write here.',
	'journal.view.day.add': 'Add an entry',
	'journal.view.day.start': 'Start this page',
	'journal.view.day.none': 'No page for this day.',
	'journal.view.day.empty': 'Nothing written.',
	'journal.view.day.broken': 'This page can’t be changed here until its file is fixed:',
	'journal.view.write.placeholder': 'Write…',
	'journal.view.write.title': 'Title',
	'journal.view.write.time': 'Time',
	'journal.view.write.entry': 'Entry',
	'journal.view.write.timeShape': 'A time looks like 21:30.',
	'journal.view.write.inexact': 'This can’t be saved exactly as it looks, so nothing was saved.',
	'journal.view.write.linkSelect': 'Select the words to link first.',
	'journal.view.write.linkAddress': 'A link needs an address that starts with https://.',
	'journal.view.todo': 'Done',
	'journal.view.clash.keep': 'Keep my words',
	'journal.view.clash.take': 'Use the new text',
	'journal.view.clash.gone': 'It is no longer on the page.',
	'journal.view.clash.now': 'It now reads:',
	'journal.view.clash.changed': 'This part just changed on the page. Your words are still here.',
	'journal.view.clash.around': 'The page changed round this while you were writing.',
	'journal.view.undo.button': 'Undo',
	'journal.view.undo.nothing': 'Nothing to undo.',
	'journal.view.undo.done': 'Undone.',
	'journal.view.undo.changed': 'Can’t undo: that part has changed since.',
	'journal.view.saved': 'Saved.',
	'journal.view.deleted': 'Deleted.',
	'journal.view.ticked': 'Done.',
	'journal.view.unticked': 'Not done.',
	'journal.view.chip.unsaved': 'Save this first; then it can go to the chat.',
	'journal.view.chip.day': '1 day',
	'journal.view.chip.days': '{count} days',
	'journal.view.leave.heading': 'Your writing wasn’t saved',
	'journal.view.leave.slow': 'Saving it is taking too long.',
	'journal.view.leave.confirm': 'Discard it',
	'journal.view.reveal.unknown': 'The journal can’t show that.',
	'journal.view.unreachable': 'The journal couldn’t be reached. Try again in a moment.',
	'journal.view.unreadable': 'The journal gave an answer it can’t read. Try again in a moment.',
} as const;

export type ViewWord = keyof typeof VIEW_WORDS;

/** The words under `key`, each `{name}` filled from `vars`. */
export function say(key: ViewWord, vars: Readonly<Record<string, string | number>> = {}): string {
	return VIEW_WORDS[key].replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}

/** Every key, for the tests. */
export const viewWordKeys = (): ViewWord[] => Object.keys(VIEW_WORDS) as ViewWord[];
