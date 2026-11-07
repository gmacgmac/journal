# The Journal as a plugin

The Journal is one page of Markdown per day, entries by time, kept in the bot's workspace. The person writes in place,
beside the chat; the bot reads and writes through tools; each sees the other's change as it lands. It is a plugin to
nclite's contract, and this page is its interface: what its folder holds, what its engine and view give, its routes, its
references, its tools, its words and its look. Built for nclite, vendored with nclite's `scripts/plugin-vendor.ts`.

**The contract is nclite's**, not this repo's: `src/vendor/plugin-host/plugin-host.ts` is a copy of nclite's `shared/plugin-host.ts`
(§ The copies of nclite's files), and its members are described there and in nclite's `docs/plugins.md`. This page names a contract
type where the Journal gives or takes one and says only what the Journal does with it. Where this page and the contract
disagree, the contract wins.

Each rule names the test that holds it. A test named here that does not exist yet says which task writes it: **JR_02** the
engine's core (the day format, the store, the routes, `watch`, `resolve`); **JR_05** the bot's tools, their instructions,
the skill and the words; **JR_03** the view's port, every piece of state inside the mount; **JR_04** the view on the real
host (`mount`, the `PluginView` it gives, the look); **build** the `bin/` changes (`bin/types.ts`, `bin/sync-*.ts`,
`bin/build-plugin.ts`), which the orchestrator assigns.

## The folder

`npm run build:plugin -- --out <dir>` writes the folder (default `dist/plugin/journal/`), and only that. The same input gives
the same bytes; nothing names the machine.

| Part | What it is | From |
|---|---|---|
| `manifest.json` | § The manifest | `src/manifest.ts` |
| `view/journal.js` | Browser ES module, one export, `mount`; no import, no chunk | `src/view/` |
| `view/journal.css` | The one stylesheet, every rule under `.journal` (§ The look) | `src/view/journal.css` and its parts |
| `engine/engine.js` | Node ES module, one export, `createEngine`; imports `node:` modules only | `src/engine/` |
| `words.json` | Every sentence the person or the bot reads, by key (§ Words) | `words/words.json` |
| `skill.md` | What the bot reads every turn while the Journal is on (§ The skill) | `skill/SKILL.md` |
| `plugin.d.ts` | The types a host compiles against (§ The types) | `src/vendor/plugin-host/plugin-host.ts` and `src/seam-types.ts` |
| `vendored.json` | The sha256 of each nclite file this repo carries a copy of, by its path in nclite (§ The copies of nclite's files) | `src/vendor/*/SHA256.json` |

Proven by `tests/build.test.ts`: "a clean build writes exactly the folder parts", "two builds give the same bytes", "the
engine bundle imports only node: modules", "the view is one file with no import, exporting only mount", "the folder names no
absolute path or user name".

## The copies of nclite's files

Two folders of this repo are copies of nclite's files, never edited here, and they are held in two different ways:

- `src/vendor/markdown/`: nclite's `shared/markdown/*.ts` (not the tests): the parser the chat uses, with block offsets
  (`parseMarkdownSpans`) and the serializer (`blockMarkdown`, `blocksMarkdown`, `inlineMarkdown`). **Code the Journal runs,
  so held byte for byte**: nclite's test compares each entry of `vendored.json` with its own file, and **a change to nclite's
  parser fails nclite's tests until this repo is synced, rebuilt and vendored again** (`docs/plugins.md` § How a plugin
  reaches nclite).
- `src/vendor/plugin-host/plugin-host.ts`: nclite's `shared/plugin-host.ts`, the contract. **Types and bounds the Journal is
  built against, so held by structure**: nclite pins the Journal's seam in its row and compiles its host against this repo's
  `plugin.d.ts`. Its `vendored.json` entry records what this build was made against and is never compared, so a change to the
  contract that is not breaking needs no rebuild here; one that is breaking fails nclite's app check until this repo is
  synced, `SEAM` is raised, and the Journal is rebuilt and vendored.

Each folder has a `SHA256.json` (file name to sha256), written by `npm run sync:nclite -- <nclite checkout>`
(`bin/sync-nclite.ts`). The build writes `vendored.json` from the two manifests, keyed by nclite's path:

```json
{ "shared/markdown/index.ts": "<64 hex>", "shared/markdown/inline.ts": "<64 hex>", "shared/markdown/parse.ts": "<64 hex>",
  "shared/markdown/repair.ts": "<64 hex>", "shared/markdown/serialize.ts": "<64 hex>", "shared/markdown/types.ts": "<64 hex>",
  "shared/plugin-host.ts": "<64 hex>" }
```

Proven by `tests/build.test.ts`: "the vendored … holds exactly the files its manifest lists, each matching its sha256" (for
each copy), "the vendored … holds no test files", "vendored.json names every copied file by its nclite path, with its
sha256".

## The manifest

`src/manifest.ts` `manifestOf(version)`, written to `manifest.json` as below (`version` is `package.json`'s). Text is a
words key. The `input` of each tool is that tool's JSON Schema exactly as `tools.list()` gives it (§ Tools).

```json
{
  "id": "journal",
  "name": "journal.plugin.name",
  "version": "0.1.0",
  "seam": 1,
  "icon": "journal",
  "view": { "module": "view/journal.js", "styles": ["view/journal.css"], "export": "mount" },
  "engine": { "module": "engine/engine.js", "export": "createEngine" },
  "chips": [
    { "kind": "block", "words": "journal.plugin.chips.block" },
    { "kind": "days", "words": "journal.plugin.chips.days" }
  ],
  "tools": [
    { "name": "read_days", "words": "journal.tool.read_days", "input": { "…": "§ Tools" }, "writes": false },
    { "name": "add_entry", "words": "journal.tool.add_entry", "input": { "…": "§ Tools" }, "writes": true },
    { "name": "replace_block", "words": "journal.tool.replace_block", "input": { "…": "§ Tools" }, "writes": true },
    { "name": "delete_block", "words": "journal.tool.delete_block", "input": { "…": "§ Tools" }, "writes": true },
    { "name": "insert_after", "words": "journal.tool.insert_after", "input": { "…": "§ Tools" }, "writes": true }
  ],
  "skill": "skill.md",
  "words": "words.json",
  "changeWords": ["journal.change.entry", "journal.change.replace", "journal.change.delete", "journal.change.insert"]
}
```

- **No `settings`.** nclite draws none yet, so the week starts on Monday (ISO) and there is no paper switch: the page
  follows the bot's light or dark (nclite PLAN O5).
- **`icon` `journal`** is a name nclite adds to its icon list when it vendors the Journal; until then nclite draws its plugin
  glyph.
- **`seam`** is `SEAM` (`src/seam.ts`), raised by one with every breaking change to `plugin.d.ts`, the contract's included.

Proven by JR_05 `tests/manifest.test.ts`: "the manifest's tools are exactly tools.list(): names, schemas and words",
"every words key the manifest names is in words.json", "every changeWords key starts journal. and is used by a tool".

## The data

`createEngine`'s `dir` is the data folder nclite makes: `.journal/` in the bot's workspace (nclite's plugin table, the
default `.<id>`). Inside, one file per day:

```
.journal/2026/11/2026-11-07.md
```

- **A day file** (`src/format/` `checkDay`, carried from the proof's `format.ts`): the first line is
  `# Weekday D Month YYYY`, matching the file's date; each `## HH:MM` or `## HH:MM · Title` starts an entry, times `00:00`
  to `23:59`; an entry's body is paragraphs, lists (to-dos included) and quotes; no front matter, no HTML, lines end with a
  plain `\n`. Dates are `YYYY-MM-DD` throughout, worked out in UTC so a time zone never moves a day.
- **Offsets** are into the file's text as a JavaScript string indexes it (UTF-16 code units), from nclite's parser:
  `parseMarkdownSpans(text)` gives each top-level block `{ block, start, end }`. The Journal never re-scans the grammar.
- **A block's key** is stable on screen and in a chip: the FNV-1a 32-bit hash of the block's text (offset basis
  `0x811c9dc5`, prime `0x01000193`, over UTF-16 code units), as 8 lowercase hex digits, then `-` and how many blocks with
  the same text come before it in the file: `9c1f02ab-0`. Any change to a block's text changes its key.
- **A day's version** is the first 16 hex digits of the sha256 of the whole file; a day with no file has version `null`.
- **Writes are atomic**: a temporary file `.<random>.tmp` in the day's own folder, then a rename over the day's file.
  A day the Journal writes is always one that passes `checkDay`.
- **Only what changed is written.** An untouched block's bytes are its slice of the file as it was (nclite's serializer cannot
  round-trip every tree); only a block the person edited in place is written from the editor's tree (`blocksMarkdown`).

**A day that breaks the rules** (the bot or the person edited the file by hand) is read, never crashed on: its blocks are
parsed as they are, and its `problems` list what is wrong, in the Journal's words. It is shown as it is, read only, with
its problems over it, and every write to it is refused (`malformed`), the bot's tools included, which tell the bot to fix
the file itself. A file larger than `MAX_DAY_BYTES` (256 KiB) is not read: its day says `too-big` and shows nothing else.
Anything in `.journal/` that is not a day file at its own path (`YYYY/MM/YYYY-MM-DD.md`, the date real) is not read.

**The bot can change `.journal/`, so the engine reads and writes it as an equal's ground** (the store's `DayFile` state
`odd`): a day path that is a link or a folder, or that sits under a month or year folder resolving outside the data
folder, is never read through or written through. Its day is shown with the problem `journal.problem.not-a-file` and
every write to it is refused. The file is opened with `O_NOFOLLOW`, and each folder above it is checked by its real path
against the data folder. A write that would make a day over `MAX_DAY_BYTES` is refused `too-big` and writes nothing. An
edit's offsets must be whole numbers from 0 with `end` not before `start`, or the edit is refused `unreadable` (a negative
`start` once counted from the end). A day lists at most 20 problems (`MAX_PROBLEMS`), each said once, so a broken page
still answers small.

Proven by JR_02 `tests/format.test.ts` and `tests/store.test.ts` (carried from the proof, with the sample days of
2026-09-28 to 2026-10-09 as fixtures under `tests/fixtures/days/`, never shipped) and: "a day that breaks the rules is read
with its problems and refused for every write", "a day over MAX_DAY_BYTES is too-big and not read, and no write makes
one", "a write leaves every untouched block’s bytes as they were, over every sample day", "a write is atomic: a reader sees
the old file or the new one, and no temp file is left", "an edit writes only under the data folder: a bad date, a link, or
a folder leading out is refused", "a day that breaks the rules says each problem once" (`tests/format.test.ts`).

## The engine

```ts
createEngine(options: PluginEngineOptions): PluginEngine   // src/engine/engine.ts
```

`PluginEngineOptions` and `PluginEngine` are the contract's. The Journal uses `dir` and `warn` (a day it cannot read, a
watch that fails); it shows nothing in place of `dir`, so `name` is not read; it reads no `flags`. It has no `image`: every
picture is the host's 404. Nothing is held in memory that the files do not say, so a restart loses nothing, and two engines
on one folder (never in nclite) would not corrupt it.

### Routes

The person's calls, through nclite's pass-through, with `caller` `{ by: 'person' }`; any other caller is answered `403`.
`path` is relative and carries its query; every other path answers `null` (nclite's `404`). A problem is
`{ "title": <sentence>, "status": <the reply's status>, "code": <code>, "day"?: Day }`.

**`GET days?from=YYYY-MM-DD&to=YYYY-MM-DD`**: every day from `from` to `to`, both included, at most `MAX_RANGE_DAYS` (93);
a day with no file is a gap, not an error. `200`:

```ts
interface Day {
	date: string;               // YYYY-MM-DD
	title: string;              // "Saturday 7 November 2026": format.ts dateTitle
	exists: boolean;
	version: string | null;     // 16 hex, null when no file
	blocks: Block[];            // empty when no file or too-big
	problems: string[];         // the Journal's sentences; [] for a day that keeps the rules
}
interface Block { key: string; start: number; end: number; text: string }
// 200: { "days": Day[], "next"?: "YYYY-MM-DD" }
// 400 problem, code "dates": not dates, backwards, or more than 93 days
```

The answer holds **whole days from `from` until the next would take the days' text past `DAYS_MAX_CHARS` (300,000
characters)**, always at least one; `next` is then the first day left out, and the view reads on from it. A day is at most
`MAX_DAY_BYTES`, so every answer stays well under the contract's `REPLY_LIMITS` `bytes`, which holds every answer of the
engine (the host answers one over it as too large).

**`POST edit`**, body one `Edit`, JSON (the proof's four edits, `src/store/edits.ts` `plan`), each anchored to bytes the view
saw and refused, never merged, when they changed:

```ts
type Edit =
	| { op: 'replace'; date: string; start: number; end: number; before: string; after: string }   // '' after deletes
	| { op: 'insert'; date: string; start: number; end: number; before: string; text: string }     // new writing after a block
	| { op: 'entry'; date: string; time: string; title: string | null; text: string }              // a new entry, by time
	| { op: 'range'; date: string; start: number; end: number; before: string; after: string };    // exact bytes: an undo
// 200: { "day": Day, "undo": RangeEdit }
// 400 "unreadable": not an Edit · 409 "changed": the bytes moved (with day) · 422 "rules", "heading", "date-heading",
//     "entry-exists", "malformed", "too-big" (with day)
```

Every saved edit answers the edit that undoes it. An `entry` at a time the day already has, or a heading replaced to such
a time, is refused `entry-exists`.

**The wire, beyond the routes above.** A served path with the wrong method is `405` (`method`) naming the method it takes
in `Allow`, which nclite's pass-through drops with every header of the plugin's. A query left on `path` (`days?from=…`) is
read. An unexpected I/O failure is `warn`ed and answered `500` (`failed`), never thrown.

**A block open for writing survives a write earlier in the same day.** The person opens a block; the bot adds an entry above
it; the person's offsets are now stale. For `replace` and `insert`, when the block at `start`..`end` is not `before` but
exactly one top-level block of the day's text now equals `before`, the engine anchors to that block instead; when none, or
more than one, does, the edit is refused `changed` with the day as it is. `range` (an undo) is never moved: it is exact
bytes. The answer's `day` gives the view the block's new offsets.
Proven by JR_02 `tests/routes.test.ts`: "days answers every day in the range, gaps included, and refuses a bad range",
"days stops before DAYS_MAX_CHARS, always gives one day, and says next", "a day that breaks the rules, or is too big, is
answered as it is, with its problems", "an open block’s save lands after a write earlier in the same day: its text found once,
it is moved", "a before found twice, or not at all, is refused changed", "an edit anchored to bytes that moved is refused with
the day as it is now", "every saved edit answers its undo, and the undo puts the bytes back", "refuses what is not an edit, a
heading, an entry at a taken time, and any write to a day that breaks the rules", "a caller that is not the person is
refused", "a path the Journal does not serve is null, and a wrong method names the one it takes"; and `tests/store.test.ts`:
"an open block survives a write earlier in the day: its text found once, the edit moves to it", "an undo is refused once the
bytes it would put back over have changed, and never moves".

### Watching

`watch(onChange)` says `{ date: 'YYYY-MM-DD' }` for each day file that appeared, changed or went, from anyone: this engine,
the bot's own file tools, the person's editor. It **polls**, because it runs in nclite's jail, which allows no system file
watcher (the board's ledger polls the same way):

- every `WATCH_POLL_MS` (1,000 ms) while a watcher is subscribed, it stats each month folder (`YYYY/MM`) and the day files
  of any month whose folder changed and of the current and previous month; every `WATCH_SWEEP_MS` (30,000 ms) it stats every
  day file; at most `WATCH_MAX_FILES` (20,000) day files;
- a file's identity is its modification time, size and inode; the first pass only records;
- a write of this engine's own says its day at once, without waiting for the next poll, and is recorded so the next poll is
  silent;
- the first pass, made when the first listener subscribes, only records; the "current and previous month" are the person's
  local today's; the timer does not hold the process open (`unref`) and stops with the last listener; a listener that throws
  does not stop the others;
- a failure to read the folder is `warn`ed once, until a pass succeeds, and the next poll tries again; it never throws out of
  the timer; more than `WATCH_MAX_FILES` day files is `warn`ed once and the rest are not watched.

The host turns each into an event `{ plugin: 'journal', ref: { date } }`; `{}` is nclite's catch-up, on which the view reads
again every day it shows. Proven by JR_02 `tests/watch.test.ts`: "a day written by another writer is said within two polls",
"an in-place edit of an old month is said by the next sweep", "a burst of writes to one day between two polls is said once",
"the engine’s own write is said at once, and not again by the next poll", "a folder it cannot read is warned once and never
throws", "a listener that throws does not stop the others, and the last stop ends the polls", "at most maxFiles day files are
watched, and the cap is warned once"; in nclite's real jail, by nclite's INT_01 test "a day file written straight into the
folder is heard by a watcher, in the jail".

### References

Every reference the Journal makes is a contract `Ref` (keys of letters, short strings), and it answers every shape it has
ever made, or refuses it, never throws:

| Ref | Shape | Made by |
|---|---|---|
| A `block` chip's `ref` | `{ date: 'YYYY-MM-DD', key: '<8 hex>-<n>' }` | The view's Add to chat on a block |
| A `days` chip's `ref` | `{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }` | `pageChip()`: the days on show |
| An event's `ref` | `{ date }`, or `{}` from the host | `watch` |
| A change line's `reveal` | `{ date, key }`, `key` the changed block's new key, absent for a removal | The tools |

### Resolve

`resolve(kind, ref)` says what a chip says now, as the message goes, or why it cannot go:

| Kind | Answers | Refuses |
|---|---|---|
| `block` | `{ where: "Journal, Saturday 7 November 2026, 21:30 · Walk", text: <the block's Markdown> }`: the block with that key on that day, under its entry | `gone`: no block of that day has that key (it changed or went), the day is gone, or the ref is not this shape |
| `days` | `{ where: "Journal, 2 to 8 November 2026", text: <each day's file that exists, in order, a blank line between> }`; `text` `''` when no day has a page | `too-long`: more than `CHIP_DAYS` (14) days, or more than `CHIP_TEXT_CHARS` (24,000) characters of text; `gone`: not this shape |
| any other | — | `gone` |

`where` and every `reason` are the Journal's words (§ Words), and no answer carries an `ack`. A day it cannot read is refused
`gone` and `warn`ed, never thrown. Proven by JR_02 `tests/resolve.test.ts`: "a block chip says the block’s text now, and is
gone once its text changed", "every block of every sample day resolves to its own text", "a days chip says each day with a
page, and refuses a range too long", "a days chip over CHIP_TEXT_CHARS is refused too-long", "an unknown kind or a ref of
another shape is refused, never thrown at", "a day it cannot read is refused gone and warned, never thrown".

## Tools

Five tools, in MCP's shapes (`tools.list()`, `tools.call()`), on nclite's wire as `mcp__nclite__journal_<name>`. Every input
is checked against its schema by the engine itself (nclite passes it through unread); every write goes through `checkDay`
and the atomic write the person's edits use; a refusal is a result with `isError: true` and
`structuredContent: { refused: <code> }`, its text one sentence saying why and what to do, never a throw. A tool's
`caller` is `{ by: 'agent', agent }`; the Journal records nothing of it.

**Every change of existing writing is anchored and versioned.** For `replace_block`, `delete_block` and `insert_after` the
bot names the day, the entry (its time) and the block's whole text as `read_days` showed it, and passes the day's `version`
from that read (required): a day that changed since is refused `stale`, an anchor that matches more than one block is refused
`ambiguous` unless `nth` says which, and the offsets the anchor found are then checked against the bytes, as the person's
edits are. The tools do not call the person's `applyEdit`: a write composes the store's pieces (`readDayFile`, the rules, the
version, the anchor, `plan`, `writeDay`) so the `version` the bot passed is checked against the very text that is planned on,
and a write landing between the tool's read and its own is refused `stale` rather than moved (the move of the person's open
block, above, is for the person's edits only). `add_entry` changes no existing writing (it places a new entry by its time), so its `version` is optional: given,
it is checked the same way; left out, the entry is placed in the day as it is now.

Shared schema parts (`$defs` written out in each tool's schema; each `description` is a words key's text, § Words):

```json
{ "date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
  "time": { "type": "string", "pattern": "^([01]\\d|2[0-3]):[0-5]\\d$" },
  "version": { "type": ["string", "null"], "pattern": "^[0-9a-f]{16}$" },
  "text": { "type": "string", "minLength": 1, "maxLength": 20000 } }
```

| Tool | Input (`type: object`, `additionalProperties: false`) | Does |
|---|---|---|
| `read_days` | `from` (date, required), `to` (date) | Reads `from` to `to` (`to` defaults to `from`), at most `READ_MAX_DAYS` (31) days and `READ_MAX_CHARS` (60,000) characters: whole days from `from` until the next would not fit, and then says where to read on |
| `add_entry` | `date`, `time`, `text` (required); `version` (null for a day with no page; checked when given); `title` (string, at most 80 characters, one line) | A new entry `## time` or `## time · title` with `text` as its body, placed before the first later entry; makes the day's page when it has none |
| `replace_block` | `date`, `version`, `entry` (a time), `block` (text), `text` (required); `nth` (integer from 1) | The block under the entry at `entry` whose whole text is `block` becomes `text`. The entry's heading is a block too: replacing it gives the entry a new time or title |
| `delete_block` | `date`, `version`, `entry`, `block` (required); `nth` | Removes that block and the blank line after it |
| `insert_after` | `date`, `version`, `entry`, `block`, `text` (required); `nth` | New writing after that block, under the same entry |

- **`block` is matched whole**: the block's text equals `block` with leading and trailing whitespace of both set aside.
  `nth` counts matches under that entry from the top.
- **`text` holds body writing only** (paragraphs, lists, quotes) except in `replace_block` of a heading; a heading in it is
  refused `heading`. The date line is never a block a tool can change (`date-heading`).

**What a read gives.** `content[0].text` is, for each day, a line naming it and its version, then the file as it is; a day
with no page says so; problems are listed under their day. `structuredContent`:

```ts
{ days: { date: string; title: string; exists: boolean; version: string | null; text: string; problems: string[] }[];
  next?: string }   // the first day not read, when the range did not fit
```

**What a write gives.** `content[0].text` says the day was saved and its new version. `structuredContent`:
`{ date, version, entry, key }` (`key` the changed or new block's, absent for a removal). `_meta` carries the contract's
change line, `nclite/change`:

```json
{ "nclite/change": { "words": "journal.change.replace", "count": 1, "subject": "Saturday 7 November 2026",
                     "reveal": { "date": "2026-11-07", "key": "9c1f02ab-0" } } }
```

`words` is `journal.change.entry`, `journal.change.replace`, `journal.change.delete` or `journal.change.insert`; `count` the
blocks written (1 for a replace, a delete or an entry; the blocks of `text` for an insert); `subject` the day's title; `reveal`
the day and the block's new key (no `key` for a removal). A refusal carries no change.

**Refusals**, each `journal.refusal.<code>` in `words.json`:

| Code | When | The bot is told to |
|---|---|---|
| `input` | The input does not fit the schema | Fix the field named |
| `dates` | A range backwards or too long | Read a shorter range |
| `stale` | The day's version is not the one passed | Read the day again, then change what is there now |
| `no-page` | A change to a day with no page | Start it with `add_entry` |
| `no-entry` / `ambiguous-entry` | No entry at that time / more than one | Read the day; fix the file itself if a time is used twice |
| `no-block` | No block under that entry has that whole text | Copy the block from `read_days`, whole |
| `ambiguous` | More than one does, and no `nth` | Pass `nth` (1 to the number of matches) |
| `entry-exists` | `add_entry` at a time the day has | Add to that entry with `insert_after`, or pick another time |
| `heading` / `date-heading` | Writing that holds a heading / a change to the date line | Use `add_entry` for a new entry; leave the date line |
| `rules` | The day would break its rules | The rules broken are named |
| `malformed` | The day already breaks its rules | Fix only what breaks the rules, with its own file tools, naming the file `.journal/YYYY/MM/YYYY-MM-DD.md`, and tell the person what was fixed |
| `too-big` | The day is over `MAX_DAY_BYTES`, or the write would make it so | Ask the person: shrinking it would lose their writing |
| `tool` / `failed` | A tool the Journal has not / an unexpected I/O failure (`warn`ed, never thrown) | Not call it / try again |

Choices the first draft of this page did not make, each tested: a `text` of only whitespace is refused `input` (the planner
would have turned a replace into a delete); an `nth` past the matches is refused `ambiguous`, saying how many match; a
write that would make a day too big says so (`journal.problem.would-be-too-big`); a description shared by several tools'
fields is one words key each (`journal.tool.field.*`), not a copy per tool; every tool carries MCP annotations
(`readOnlyHint` for `read_days`, `destructiveHint` for `replace_block` and `delete_block`), and an input is checked by `badField`
(`src/engine/tools/check.ts`), a JSON Schema subset the tools use, with lengths in code points.

`tools.instructions` is one sentence (`journal.tool.instructions`): read the days first, and pass back the version read.

Proven by JR_05 `tests/tools.test.ts`: "read_days gives each day with its version and says where to read on",
"a day that breaks the rules is read with its problems, and one too big is named and not read", "add_entry places an entry by
time and makes a missing page", "replace, delete and insert change only the anchored block", "a stale version is refused and
nothing is written", "an ambiguous anchor is refused unless nth says which", "a write's _meta is the contract's change
line, inside its bounds", "every refusal is a result with its code, never a throw", "an input outside its schema is refused
input", "lists the five tools, each with a closed object schema, and says the instructions"; `tests/manifest.test.ts`: "the
manifest's tools are exactly tools.list(): names, schemas and words", "every changeWords key starts journal. and is used by a
tool"; nclite's INT_01 "the Journal's tools add, change and read entries through the run
door".

## The skill

`skill/SKILL.md`, written to `skill.md`, at most `SKILL_BYTES` (contract: 8,192 bytes), aiming at half that, since it rides
every turn while the Journal is on. No front matter. In this order:

1. What the Journal is: the person's journal, one page a day, entries by time, kept in `.journal/` in the workspace. Change
   it with the tools, never by writing the files, so the person sees each change and nothing is half-written.
2. Read first: `read_days`, and pass each day's `version` back with every change.
3. Which tool for what, one line each.
4. A page's rules, in four lines (the date line, entries by time, body kinds, no HTML).
5. The person's words are theirs: change them only when asked, and add an entry in their voice only when asked to log
   something for them.
6. What to do on `stale`, `ambiguous` and `malformed`: on `malformed` it fixes only what breaks the rules and tells the person
   what it fixed.

It is a prompt: a change to it runs its scenarios (nclite TRACKER `N220`). Proven by JR_05 `tests/skill.test.ts`: "the
skill is within SKILL_BYTES", "every tool the skill names is a tool of the manifest".

## The view

```ts
mount(root: HTMLElement, host: PluginHost): PluginView   // src/view/view.ts
```

`root` is empty and has a definite size. The view adds the class `journal` to it, draws everything inside it, and talks to the
world only through `host`. **Every piece of state belongs to one mount**, made by `mount` and dropped by `unmount`: no
module-level variable holds a day, a session, a listener or a timer, so two mounts in one page share nothing.

It opens on **the current week**, Monday to Sunday, around the person's local today; the range bar moves by the span shown
(Previous, This week, Next) or to any dates (from, to). It draws the days as facing pages, patches only the days that changed,
and writes in place: a click or Enter on a block opens it for writing; leaving it saves; a to-do ticks and saves at once;
Undo is a toast inside `root`.

**What it uses of the host:**

| Member | The Journal's use |
|---|---|
| `api` | `days?from=…&to=…` (GET, followed by `next` until the range is read) and `edit` (POST, `content-type: application/json`), paths with no leading `/`; a reply with status 400 or more is a problem (§ Routes) |
| `events` | `{ date }` within the range shown reads that day again; `{}` reads every day shown again; any other ref is ignored |
| `chat` | `add(chip)` for a block's Add to chat in the writing bar (a `block` chip); nothing is staged by `attach`; no `send` |
| `settings` | Nothing |
| `notify` | A refused save or tick (`error`), and a reveal it cannot show. A refused save that is a clash stays in the writing bar with its two choices instead |
| `confirm` | Only from `leave()`, when writing could not be saved |
| `store` | Nothing |
| `imageRoute` | Nothing |

**What it gives back** (`PluginView`):

| Member | Promise |
|---|---|
| `unmount()` | Removes every listener and timer it added, empties `root` and takes its class off. Never asks and never saves: the host calls `leave()` first |
| `unsaved()` | True while a block open for writing holds text other than what was saved |
| `leave()` | Nothing unsaved: true at once. Else saves it: saved, true. Refused, or not answered within half the contract's `VIEW_ANSWER_MS` (`LEAVE_SAVE_MS = VIEW_ANSWER_MS / 2`, from the contract copy, never a number of its own): asks through `confirm` ("Your writing wasn't saved", the reason, "Discard it"), true when discarded, false to keep writing, focus back in the block. So it always answers, or opens the pane's confirm, within the host's wait. A call while one is asking gets the same answer. If the host gave up and closed it anyway, nothing after `unmount` acts |
| `pageChip()` | A `days` chip for the range shown: label "2 Nov – 8 Nov", detail "7 days" (§ Words). Never more than `resolve` takes: null when the range is longer than `CHIP_DAYS` or the days shown hold more than `CHIP_TEXT_CHARS` of text, so the header's Add to chat has nothing to add rather than a chip that would be refused |
| `reveal(ref)` | `{ date }` or `{ date, key }`: shows the week holding `date` and marks the block with `key`, or the day when the key is gone; `{ from, to }`: shows that range. A ref of another shape, or a date that is not one, is said through `notify`, and nothing moves |

A chip is `{ kind: 'block', ref: { date, key }, label: "Sat 7 Nov · 21:30 · Walk", detail: <the block's first 72
characters, flattened> }`, inside the contract's `CHIP_LIMITS`. A block not yet saved cannot go to the chat (the view says so).

**Keys.** A key the view acts on is `preventDefault`ed inside `root`; it uses no capture-phase listener on the window or the
document. Undo is `Cmd/Ctrl+Z` only while focus is in `root`.

Proven by `tests/view/` (pure parts, and the whole mount on its fake DOM, `tests/view/fake-dom.ts`): JR_03
`tests/view/mount.test.ts` (two journals in one page share nothing, and unmount leaves nothing behind); JR_04 "the range opens
on the current week, Monday to Sunday", "a block's Add to chat calls chat.add with a chip inside CHIP_LIMITS", "pageChip is
null for a range longer than CHIP_DAYS or holding more than CHIP_TEXT_CHARS", "a range is read in parts, following next", "a reveal of
each ref shape the Journal has made is understood, and any other is said through notify", "leave saves, and asks through
confirm only when the save is refused or slower than VIEW_ANSWER_MS / 2", "an event of {} reads every day shown again". In a real browser, by nclite's smoke rows for the Journal (INT_01): opens on
the current week, writes in place, two bots' Journals open at once without sharing, closing with unsaved writing saves it.

## The look

`view/journal.css`: every selector under `.journal` (a class `.journal` or `.journal-…`), custom properties `--journal-*`, no
`@import`, no `url()` but `data:`, no `@font-face`: nclite refuses a stylesheet that breaks this (`docs/plugins.md` § A guest in
the app's page). The view reads the contract's `HOST_PROPERTIES` and nothing else of the page, and keeps the proof's warm
paper as its own look when the host sets none.

- **Mode**: `.journal { color-scheme: var(--host-color-scheme, light dark) }`. Every colour of the Journal's own is a
  `light-dark()` pair, kept native in the built stylesheet, so it follows the bot's light or dark live.
- **Type**: `--journal-font: var(--host-font, system-ui, sans-serif)`, `--journal-mono: var(--host-font-mono, ui-monospace, monospace)`;
  the date headings keep the paper's serif, `--journal-serif` (the Journal's own); `--host-text-scale` scales the page's text
  (default 1).
- **Paper, tinted by the bot's colour**: each token is a host property, or a small mix of the bot's accent into one, so the
  page reads as paper in the bot's colours:

| Token | Is | Without the host |
|---|---|---|
| `--journal-desk` | `color-mix(in oklab, var(--host-canvas) 92%, var(--host-accent) 8%)` | `light-dark(#e6dccb, #13100f)` |
| `--journal-page` | `color-mix(in oklab, var(--host-surface) 95%, var(--host-accent) 5%)` | `light-dark(#fbf6ec, #1c1916)` |
| `--journal-field` | `var(--host-surface)`: the ground of a block open for writing | `light-dark(#fffdf8, #25211e)` |
| `--journal-hover` | `var(--host-surface-sunken)` | `light-dark(#f4ecdf, #25211e)` |
| `--journal-fresh` | `color-mix(in oklab, var(--journal-page) 78%, var(--host-accent) 10%)`: a block just changed or revealed (22% failed the contrast rule with the host's values: muted text Lc 53.6 in light, links Lc 43.8 in dark) | `light-dark(#f3dfc1, #3b2d22)` |
| `--journal-rule`, `--journal-field-line` | `var(--host-line)`, `var(--host-line-strong)` | `light-dark(#e4d8c4, #332d29)`, `light-dark(#d8c8b0, #463f3a)` |
| `--journal-ink`, `--journal-ink-soft` | `var(--host-ink)`, `var(--host-ink-muted)` | `light-dark(#2a241e, #ece5da)`, `light-dark(#6f5f4a, #c6baac)` |
| `--journal-date-ink`, `--journal-link` | `var(--host-accent-strong)` | `light-dark(#8a4320, #f2a77c)`, `light-dark(#9b4519, #ff9a66)` |
| `--journal-fill`, `--journal-fill-hover`, `--journal-on-fill` | `var(--host-accent-fill, var(--host-accent))`, `var(--host-accent-fill-hover, var(--host-accent-strong))`, `var(--host-on-accent)` | the proof's |
| `--journal-focus` | `var(--host-focus, var(--host-accent))` | `light-dark(#c4501f, #ff8a4f)` |
| `--journal-warn`, `--journal-shadow`, `--journal-fold` | The Journal's own, whatever the host sets | the proof's |

Each token is declared on `.journal` with its host form, whose `var()` falls back to the right-hand column. **Contrast**: ink
and soft ink on desk, page, field, hover and fresh meet APCA Lc 60, and date ink and links Lc 45, for the host values of
nclite's table (the board spec's § Theme and host styling) in light and dark, and for the Journal's own: the mixes stay small
enough that the host's own pairs carry over. Proven by JR_04 `tests/view/colours.test.ts` (its own APCA-W3 0.0.98G-4g, a test
helper): "every pair meets its tier with the host's values and without them, light and dark", "the stylesheet reads only host
properties of the contract's list", "every rule is under .journal".

## Words

`words/words.json`: one flat object, every key `journal.<area>.<name>`, every value one sentence or label, `{name}` marking
a value filled in. Nothing the person or the bot reads is written in the code. The areas:

| Keys | What | Read by |
|---|---|---|
| `journal.plugin.name`, `journal.plugin.chips.block`, `journal.plugin.chips.days` | "Journal", and what each chip kind is | nclite (the manifest) |
| `journal.tool.<tool>`, `journal.tool.<tool>.<field>`, `journal.tool.field.<name>`, `journal.tool.instructions` | Each tool's description, each input field's (one key for a field several tools share), and the instructions | The bot |
| `journal.read.*`, `journal.saved` | The lines of a read (a day and its version, no page yet, where to read on) and of a saved write | The bot |
| `journal.refusal.<code>` | Each refusal (§ Tools), e.g. `journal.refusal.stale` "This day changed since you read it. Read it again with read_days, then make your change against what is there now." | The bot |
| `journal.change.entry`, `.replace`, `.delete`, `.insert` | "Added an entry to {subject}", "Changed writing on {subject}", "Removed writing from {subject}", "Added writing to {subject}" | nclite's change line |
| `journal.chip.*` | A chip's `where` ("Journal, {title}, {entry}"; "Journal, {from} to {to}") and each refusal's reason | The bot; the person, under a refused chip |
| `journal.problem.*` | Each rule a day breaks (`checkDay`), each route problem | The person, the bot |
| `journal.view.*` | The range bar, the writing bar, Undo and its toast, a block's and the range's chip labels, the leave question, a reveal it cannot show, a page that breaks the rules | The person |

`words/words.ts` is the one home of `WORDS` and `fill`; the engine's `word()` and the view's `say()` both read it. The engine
bundles `words.json` at build, the view bundle carries the whole file, and the folder ships the same file, so they cannot
differ. Proven by JR_05
`tests/words.test.ts`: "every key the code names is in words.json, and every key in it is named", "no string literal in
src/ is a sentence" (src/vendor/ excepted), "every placeholder a sentence holds is filled where it is used".

## The types

`plugin.d.ts`, made at build from the code (`bin/types.ts` `pluginTypes`), never by hand: the declarations of the vendored
contract, `src/vendor/plugin-host/plugin-host.ts`, then those of `src/seam-types.ts`, which may import from the contract copy
and from nothing else; the one import is dropped from the output, since its declarations come first. One module, no import.
`src/seam-types.ts` declares:

```ts
export declare function mount(root: HTMLElement, host: PluginHost): PluginView;
export declare function createEngine(options: PluginEngineOptions): PluginEngine;
export interface BlockRef { date: string; key: string }
export interface DaysRef { from: string; to: string }
export interface Day { /* § Routes */ }
export interface Block { /* § Routes */ }
export type Edit = /* § Routes */;
export interface ReadResult { /* § Tools, what a read gives */ }
export interface WriteResult { date: string; version: string; entry: string; key?: string }
```

`src/engine/engine.ts` and `src/view/view.ts` are typed by these, so the build fails when the code and the types part.
nclite compiles its host against this file (`docs/plugins.md` § The seam number): that, with the seam its row pins, is
what holds the Journal to the contract. Proven by `tests/build.test.ts`: "plugin.d.ts is one module with no import, and
compiles alone with the DOM types", "a host that gives the contract's PluginHost compiles against it".

## Not covered

- The skill and the tool descriptions as prompts: no scenario has been run on a real turn (nclite TRACKER `N220`).
- A tool's `read_days` budget and refusal sentences are held by tests for their codes and fields, not for how a model acts on
  them.
- The caret, focus, layout and typing need a real browser, which this repo's fake DOM is not; nclite's smoke rows walk them.
- A day the person and the bot change in the same second: each change is anchored, so the second is refused, never merged;
  the person sees the refusal, and the bot reads again.
- Moving the notes out of the workspace, a lock, and a journal for more than one person (nclite PLAN, Out of Scope).
