---
name: cortex-word-review
description: "A local review page where the user approves many sentences or decisions at once: accept each proposal, write their own, or ask a question, row by row. Use when the user must approve several pieces of wording or several decisions, says \"put it on the review page\", \"add a round\", \"read my answers\" or \"check the review\", or when a task needs word-for-word sign-off before text is implemented. Rounds are JSON files in cortex-tasks/word-review/; a small zero-dependency Node server shows them."
---

# Word review

The user accepts, rewrites or questions each proposed sentence on a page served from this repo.
No account, no outside service. The agent writes the rounds and reads the answers straight from
JSON files.

This is how wording in words files gets approved as a set (`cortex-architecture` →
`references/words.md` § Changing words). One or two sentences? Ask in chat instead.

## Start it

Needs Node 18 or newer. From the project root (every mirror of this skill is identical, so
`.kiro/`, `.agent/` or `.claude/` all work):

```bash
node .claude/skills/cortex-word-review/server.mjs
```

It prints `http://127.0.0.1:3390/`. `WORD_REVIEW_PORT` changes the port; `WORD_REVIEW_DIR` the
rounds folder. It binds 127.0.0.1 only, takes writes only from its own page, and changes only the
user's fields; it never touches `proposed` or `reply`. If something already listens on the port,
it is probably the server: open the URL.

When a round is ready, start it and open it for the user, unasked:

1. **Open the page beside the chat** if your tool has a browser pane. In the Claude desktop app:
   `preview_start` with the name `word-review`. If `.claude/launch.json` has no such entry, add
   one to its `configurations`:
   ```json
   { "name": "word-review", "runtimeExecutable": "node", "runtimeArgs": [".claude/skills/cortex-word-review/server.mjs"], "port": 3390 }
   ```
   No browser pane: start the server and give the user the URL.
2. **Watch the signal file** if your tool can (§ Know when the user is done), so Send wakes you.
3. **Tell the user in one line** which round to pick.

Run it from the checkout whose `cortex-tasks/word-review/` holds the live answers, and write
replies into that same checkout. A git worktree has its own copy of the folder.

## The page

- **Top bar:** the round picker (● open, ✓ done, with done/total), a progress bar, counts, To do /
  All, **Tick all** and **Send**. Tick all accepts every open proposal except pick-one rows, in one
  write, and turns into Undo right after.
- **Each card:** Now (removed words struck through), Proposed (added words marked), then Accept,
  Write my own, and Comment or ask. The agent's answer shows under the comment.
- New rows and answers appear without a reload. A row stays in view for the visit once it has
  waited, so it does not vanish the moment it is ticked.

## Files

- `cortex-tasks/word-review/<slug>.json`: one file per round,
  `{ "round": "<project> · R<n> · <topic>", "items": [ ... ] }`.
- `cortex-tasks/word-review/signals.jsonl`: one line per Send press.
- Slugs are lower-case kebab: `<project>-r2-settings-screens`.
- `cortex-tasks/word-review/.added.json`: the date each round and row first appeared, written only
  by the server. Rounds list oldest first, rows by that date then `order`, so the newest is always
  at the bottom.

## Row shape

```json
{ "id": "S04", "group": "Settings › Sync", "order": 4, "audience": "user",
  "where": "B30 · the sync switch, its hint", "current": "...", "proposed": "...",
  "ok": false, "yours": "", "comment": "", "reply": "", "changedAt": "" }
```

- **The agent writes:** `id`, `group` (the heading rows sit under), `order`, `audience`, `where`
  (source id first, then ` · ` and a plain description), `current` (today's text; empty when new),
  `proposed`, `reply`.
- **`audience`:** `user` when people read the sentence (screen text, emails), `agent` when an AI
  model does (tool descriptions, prompts, refusals). Other values show as written.
- **A pick-one pair** has `CHOOSE ONE with <other id>` in `where` on both rows, so Tick all leaves
  them for the user.
- **A decision** uses the same shape: `proposed` states it in a sentence or two, `current` says
  what is true today.
- **The user writes (page only):** `ok`, `yours`, `comment`, `changedAt`. The agent never edits
  these.

## Add a round

Write a new `<slug>.json` with the shape above (`ok: false`; leave `yours`, `comment`, `reply`
out). The page picks it up within a few seconds. To add rows to an open round, append items; never
reorder or renumber existing ids. Then tell the user in one line which round is ready.

## Wording rules for `proposed`

- The project's own writing rules come first (its style guide in project steering or `AGENTS.md`).
- Plain and human. No raw codes, no repo-speak.
- One sentence per line.
- An error says what happened and how to fix it.
- The same word for the same thing, everywhere.
- No personal data in examples.

## Read the answers cheaply

Never read whole rows back. One `jq` per round prints only what is needed:

```bash
jq -r '.items[] | (.where | split(" · ")) as $w | (((.yours // "") | test("\\S")) and .yours != .proposed) as $mine | "\(.id)\t\(if ($w | length) > 1 then $w[0] else "-" end)\t\(if .ok or $mine then "OK" else "--" end)" + (if $mine then "\n  MINE: \(.yours)" else "" end) + (if ((.comment // "") | test("\\S")) and ((.reply // "") == "") then "\n  ASKS: \(.comment)" else "" end)' cortex-tasks/word-review/<slug>.json
```

Per row: id, source id from `where` (`-` if none), then `OK` or `--`, then `MINE:` and `ASKS:`
lines when they apply.

## What each state means

- `OK`, no `MINE`: the user accepted `proposed`. Use it as written.
- `MINE: <text>`: the user wrote their own version. It is approved. Use it word for word,
  including line breaks.
- `--` with no `ASKS`: not decided yet.
- `ASKS: <text>`: a comment with no `reply`. Answer it first, before anything else on that row.

## Answer a comment

Set `reply` on the row: plain sentences that answer the question asked. If the answer changes the
wording, also rewrite `proposed`. Edit the file directly, leaving `ok`, `yours` and `comment` as
the user left them. The page shows the answer under the comment, and the row's badge changes to
"Answered". If the user had accepted the old proposal and you changed it, say so in the reply so
they look again.

## Know when the user is done

The user presses **Send** on the page or says "done" in chat. If your tool can watch a file (Claude
Code: the Monitor tool), watch the signal file while a round is open, so the press wakes you:

```bash
tail -n 0 -F cortex-tasks/word-review/signals.jsonl
```

Each line is `{"at", "round", "ticked", "of", "edited", "comments"}`. On a line, or on "done", run
the `jq` above. Answer any `ASKS` first, then continue. A watch can expire (Claude Code's Monitor
after 30 minutes): re-arm it while the round is open, and stop it when the round is closed. No
watch available: wait for "done" in chat.

## After approval

Write the approved text (accepted `proposed`, or `MINE` word for word) into the task, as a file
next to the task, one entry per source id. The task says to implement it word for word. Do not
paraphrase. Leave the round file in place; it is the record.

## Changing the server or page

Run the checks after any change to `server.mjs` or `page.html` (in the template repo, or when
reporting a fault upstream):

```bash
node --test .claude/skills/cortex-word-review/server.check.mjs
```
