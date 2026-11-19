---
category: [from PROFILE §2]
type: tracker
status: active          # active | paused | archived
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
scope: [One line: what this tracker covers]
keywords: [keyword1, keyword2, keyword3]
---

# [Name] — Tracker

> **A queue of open items.** This file is live state only. The history of what landed is the
> task files under `cortex-tasks/` plus `cortex/LOG.md`. Decisions, architecture and detail
> belong elsewhere. Keep it short — aim for under ~250 lines.

---

## How this file works

1. **Every item becomes part of a Cortex task.** Work items one at a time, or batch similar items
   into one task.
2. **On completion, delete the row** and its detail block. Never strike through or mark done.
3. **A row is removed only when a completed task references it** (the task's `tracker:` field).
   The task and its LOG line are the record.
4. **A dropped item** (duplicate, won't do, no longer matters) is deleted with one LOG line as its
   record:
   `[[YYYY-MM-DD HH:MM]] [category] Dropped {ID}: {reason} → Notes: \`path/to/this-tracker.md\``
5. **IDs are stable and never reused.** The prefix is the bucket the item started in; an item that
   moves bucket keeps its ID. Cross-reference by ID and title.
6. **New items land in the bucket that matches**, not at the bottom.
7. **A problem found outside the current task becomes a row**: the problem and an example. Add a
   solution if known — "unknown" is a valid answer.
8. **A workaround is recorded when it is taken**, with how it ends.

**Buckets** answer *when does this hurt*, not *how hard is it*. Rename or replace them per
project; keep one letter prefix per bucket.

| Bucket | Prefix | Means |
|---|---|---|
| **Urgent** | U | Blocks the current milestone, loses data, or is the first thing a user sees fail |
| **Near Term** | N | Bites soon in real use |
| **Medium Term** | M | Real debt with a known shape; costs more the longer it waits |
| **Long Term** | L | Needs something else to exist first, or is a bet |
| **Parked** | — | Waiting on a gate: a proof, a validation, a decision. Keeps its original ID |
| **Workarounds** | W | Shortcuts taken on purpose, to resolve or ratify |

---

## Status — YYYY-MM-DD

[At most 5 sentences, overwritten on every close-out. Where things stand and what the next move
is. No counts or progress figures.]

---

## URGENT

| ID | Item | Why | Source |
|---|---|---|---|
| U1 | [Short title] | **Problem:** … **Example:** … **Solution:** … or unknown | [who/what raised it, date] |

## NEAR TERM

| ID | Item | Why | Source |
|---|---|---|---|

## MEDIUM TERM

| ID | Item | Why | Source |
|---|---|---|---|

## LONG TERM

| ID | Item | Why | Source |
|---|---|---|---|

## PARKED

| ID | Item | Waiting on | Source |
|---|---|---|---|

### U1 — [title] (optional detail block)

[Only when a row needs context. About 15 lines at most; anything longer belongs in a task file.]

---

## WORKAROUNDS

| ID | Shortcut | Why taken | How it ends |
|---|---|---|---|
| W1 | [What was done instead] | [Why] | [The fix, or "ratify as the design"] |
