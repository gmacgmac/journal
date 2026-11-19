---
name: cortex-garden
description: "Run the Gardener: coalesce unprocessed LOG entries into threads, verify each against the tree, check the tracked doc surface (REGISTRY docs.include) for drift and fix it, report drift in flagged files (docs.flag) without editing, detect ripple effects read-only outside it, route to handlers, and append a checkpoint to AUDITED. Use for \"run garden\", \"process the log\", \"check for doc drift\", or verifying a completed change."
---

# Garden

Process `LOG.md` in **threads**, not lines. A thread is one story — a seed entry plus everything that continues it, however many entries that turns out to be. Per thread: verify against the actual tree, check doc drift inside the tracked surface, route to handlers, write one checkpoint to `AUDITED.md`.

## Scope tiers — what may be touched

Read scope and write permission are **different things**. Load `REGISTRY.md` `docs` before any drift work.

| Tier | What | Gardener may |
|------|------|--------------|
| **Tracked** | `docs.include` — explicit paths only | read **and fix in place** |
| **Flagged** | `docs.flag` — explicit paths only | read, drift-check, **report** — never edit |
| **Observable** | whatever `deep_ripple_scan` reaches outside `include` and `flag` | **read only** — propose, never edit |
| **Off-limits** | `docs.exclude` — the single source of truth for this tier | neither read for drift nor write |

- `docs.include` is authoritative. `docs.hint` only *proposes* candidates — an unlisted path is not tracked, however well it matches.
- Precedence, safest wins: `exclude` > `flag` > `include`, regardless of match specificity.
- A Flagged drift is always a `[needs-human-input]` DRIFT line, never a fix — however small. See `references/engine.md` § Doc-Drift Check.
- `cortex/LOG.md` and `AUDITED.md` sit outside all tiers: edited only via this skill's own mechanics (remove a processed thread's entries, append a checkpoint). Never drift-checked, never rewritten.
- An Observable finding is a **proposal to track the path**, never an edit — regardless of how small or mechanical the fix looks, and regardless of mode.

## Entry point

1. Read `LOG.md` in full. Its current top-to-bottom content **is** the complete unprocessed backlog — no marker lookup first (see `references/engine.md` § Marker policy for why).
2. Take the single oldest entry as the seed for thread 1.
3. Work threads oldest-seed-first until the agreed thread budget is met, or the file is empty.
4. After each thread: remove its entries from `LOG.md`, append one checkpoint to `AUDITED.md`, report back. Re-derive the next seed from `LOG.md`'s **current** state — never from a snapshot taken before this thread's edits.

## Thread boundary

From the seed, pull in another entry if **any** hold:

- **Same task folder** (`cortex-tasks/{concern}/{task}/…`) — always, regardless of category or time gap.
- **Explicit forward-reference** — "CORRECTION to", "resolves", "CLOSED", "SUPERSEDED", "carried forward from" — pointing at the seed or an already-included entry.
- **Same exact timestamp** as an included entry — a simultaneous batch is one unit of work by construction.
- **Direct topical continuation** with no task-folder link (a roadmap draft and its later "revised post-research"). Judgment call; err toward inclusion when the *subject* is identical.

Never pull an entry in on **category tag alone**. Same tag + different task folder + different subject + no forward-reference → leave it. It surfaces as its own thread when its turn comes.

State the boundary in the checkpoint, **including what you deliberately did not fold in and why**. That line is the highest-value one for catching a wrong call later.

## Per-thread workflow

1. **Verify** — task file(s) `status: completed`, plus the parent's subtask table (subtasks often ship with no dedicated LOG line). Any code/behavior claim: check the real file before writing it into the checkpoint as fact. See `references/engine.md` § Verification.
2. **Check ripples** — doc-drift algorithm against the **Tracked** and **Flagged** tiers (Flagged reports only); deep scan reads Observable and proposes only. See `references/engine.md` § Doc-drift.
3. **Route** — resolve per `router.md § Resolution`; execute the handler.
4. **Record** — append one checkpoint to `AUDITED.md`; reconcile `needs-human-input` items per `references/engine.md`.

Before new verification work, cross-check earlier checkpoints **in this same session** — a later thread may cite something an earlier one already fixed. Cross-reference, don't redo.

## Checkpoint format (appended to `AUDITED.md`)

```
[[PROCESSING_TIME]] [gardener] ✓ [[SEED_TIME]] [CATEGORY] Description: N entries coalesced, SEED_TIME → LAST_TIME
  → Domain: {categories touched, primary first}
  → Thread boundary: what the thread runs through, and what shared a category or
    timeframe but was deliberately NOT folded in, and why
  → Verified COMPLETE: task file status + subtask table, not just LOG text
  → Files Changed: `file1.ext`, `file2.ext` (the original work's files, for context)
  → Docs Checked: `doc.md` (last_updated YYYY-MM-DD) — clean | fixed §N | escalated.
    Note where recency was used as a confidence signal instead of full re-derivation.
  → Ripple Actions: what this pass actually wrote, or "none"
  → Drift flagged: each Flagged file + section reported via a DRIFT line, or "none"
  → Unresolved: each needs-human-input touched — re-appended | closed | newly created — with evidence
  → LOG Cleanup: N entries removed, range SEED_TIME → LAST_TIME; re-appended vs removed outright
```

## Pacing

Budget is a **thread count**, agreed with whoever's watching — commonly 1–5 before pausing to report. Effort scales with thread size, not entry count: a single-thread session can be the deepest work of the day or the fastest. Report between checkpoints rather than promising fixed ground covered.

## Handling ambiguity

Apply the **Collaborative Resolution Protocol**:
- **Interactive** (user present): surface the ambiguity, offer the decision menu (clarify / accept-guess / defer / create-handler / link-handler), then act.
- **Unattended batch**: log-and-defer — keep the `[needs-human-input]` entry in LOG, note it in the summary.

## Non-negotiables

1. Never skip an item because the work looks minor or cosmetic. Severity affects priority, never capture.
2. Never silently drop a category with no registered handler — route it, log it with the reason, or escalate.
3. When in doubt, capture. The Gardener is the safety net, not the filter.
4. Every recorded gap names the file, the section, what's wrong, and the source.
5. Drift is checked inside the **Tracked** and **Flagged** tiers (`REGISTRY.md` `docs.include`, `docs.flag`) + registered categories (`REGISTRY.md` + `PROFILE.md` §2). `deep_ripple_scan` is the read-only safety net for what that misses.
5a. **Never edit a file outside the Tracked tier.** Off-limits paths are not even read for drift. A Flagged drift is reported, never fixed. An Observable finding becomes a proposal to track the path, never a fix — no exceptions for "obvious" or "one-line" corrections.
6. No PII in doc examples — a defect if found; fix or escalate.
7. Verify against the tree before writing a claim into a checkpoint or using it to close something. Never relay an unverified LOG entry's prose as fact — including entries inside your own thread.
8. State what was deliberately **excluded** from a thread, not just what was included. Silent scope decisions are the likeliest source of a wrong coalesce.

For verification detail, the doc-drift algorithm, `needs-human-input` mechanics, and the marker policy, read `references/engine.md`.

## Summary output

| # | Thread (N entries) | Category | Docs Checked | Ripple Actions | Status |
|---|--------------------|----------|--------------|----------------|--------|
| 1 | … | … | … | … | ✓ / ⚠️ |

Plus: Unresolved Items, Deep Ripple Scan findings.
