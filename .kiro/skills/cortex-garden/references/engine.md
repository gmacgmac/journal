# Gardener Engine — Detailed Mechanics

The detailed step engine powering the `cortex-garden` skill.

> Thread model, boundary rules, per-thread workflow, checkpoint format, pacing, ambiguity handling and the non-negotiables live in `SKILL.md` and are not repeated here. This file is the *how* behind those steps.

---

## Verification by item type

| Item Type | Verification Steps |
|-----------|-------------------|
| **Task Completion** | Read task file → confirm `status: completed` → check the parent `TASK-STATUS.md` subtask table (subtasks frequently ship with no dedicated LOG line — trust the folder listing and status table over LOG-grep) → if incomplete, create a LOG follow-up |
| **Code Change** | Grep the real symbol / read the real function before asserting the change landed, and **doubly** when the claim is being used to close a `needs-human-input` or an open question — a later entry claiming "fixed" is itself unverified → then check docs scoped to the REGISTRY surface → check API/test impact → create update items if needed |
| **System/Config Change** (`[cortex-infra]`) | **Verify only — never fix.** Managed `cortex-*` files (all of `cortex/`, plus `cortex-*`-prefixed rules/skills/steering under `.kiro/`, `.agent/`, `.claude/`) are Off-limits: they're overwritten by `copier update`, so a fix silently reverts. Confirm the version header was bumped and note any gap in the checkpoint; if `readme.md` or `PROFILE.md` looks out of step, raise `[needs-human-input]` rather than editing. No doc-drift pass — `cortex-infra` is `virtual`, so it yields no drift scope. |
| **No Handler** | Note "No handler defined" → relocate to AUDITED with that note |

---

## Doc-Drift Check

For every project-domain thread. Tiers are defined in `SKILL.md` § Scope tiers — steps 1–5 cover **Tracked and Flagged**.

1. **Load the fence**: read `REGISTRY.md` `docs`. `include` = Tracked. `flag` = Flagged. `exclude` = Off-limits, dropped from every search below. Precedence: `exclude` > `flag` > `include`. `hint` is a proposal source, not a matcher. No `flag` key = no Flagged tier.
2. **Discover relevant docs within Tracked and Flagged**: `cortex-search` (Layers 1–3), scoped to `include` + `flag` paths, for docs related to this thread's domain.
3. **Check each discovered doc** against the thread — see § Recency for how hard to look.
   - Not stale → no action.
   - Stale, **Tracked** → fix now, OR `[needs-human-input]` naming: exact file + section, what's missing/wrong, and the source change.
   - Stale, **Flagged** → never edit. Append one DRIFT line per drifted file to `LOG.md`, and list it under `Drift flagged` in the checkpoint. The developer approves; the fix lands through the normal change protocol:
     ```
     [[YYYY-MM-DD HH:MM]] [needs-human-input] DRIFT {file} § {section}: {what is stale}; source {change} → Notes: `{file}` ({section heading})
     ```
4. **No relevant doc found in Tracked or Flagged**:
   - A tracked or flagged folder covers this domain but no doc matches → `[needs-human-input]`: propose creation.
   - Nothing in Tracked or Flagged covers this domain → `[needs-human-input]`: propose a new `docs.include` entry (see § Proposing a new tracked path).
5. **After any doc change**: check whether `cortex/readme.md` is left inaccurate. It is Off-limits (managed — a fix reverts on `copier update`), so **raise `[needs-human-input]`, don't edit it**.
6. **Deep Ripple Scan** (`deep_ripple_scan: true`, PROFILE §1): a **read-only** pass over Observable — outside `include` and `flag`, never into `exclude`. A hit is never fixed, only proposed (§ Proposing a new tracked path). If nothing is affected, record "no impact" and move on.

> **Layer 4 (FRONTMATTER_SEARCH)**: auto-detected — when discovered docs carry frontmatter, use it to disambiguate overlapping scopes.

> **Scope Boundary Warning**: an incomplete `include` gives false confidence, and the deep scan is the only net under it. Declare tracked paths generously — but declare them, rather than relying on the scan, because only Tracked paths ever get fixed.

### Recency as evidence — and its limit

The question is always **"does this doc reflect *this thread's* change?"** A doc's `last_updated` never answers that question, because the recent touch was usually unrelated work.

- **The claim under audit is always checked directly.** An old thread whose docs were never updated stays drifted no matter how fresh the file looks. A recent `last_updated` from an unrelated task is not evidence that this thread's change was documented.
- **Recency only lowers effort on the rest of the doc.** Where a doc was re-touched days (not weeks) ago by later work, treat its *other* claims as recently seen: spot-check the ones most likely to have drifted rather than re-deriving the whole doc from source.
- **Stale or never-updated** → read it properly and compare against the tree.
- **Say which mode you used** in the checkpoint, with the `last_updated` date. Silent shortcuts are indistinguishable from missed drift.

### Fix now vs escalate

Applies to **Tracked** files only. Anything Flagged or Observable escalates by definition, however trivial the fix.

- **Fix now** when the correction is small, mechanical and directly verifiable (a renamed path, a wrong table entry) — or when you can accurately describe new behavior after reading its actual implementation, not guessing from the LOG summary.
- **Escalate** (`[needs-human-input]`: file + section + gap + source) when the fix needs substantial new prose in a large doc you haven't read end-to-end, or judgment you're not positioned to make in passing. Don't rush a big doc to close out a small thread.

---

## Proposing a New Tracked Path

The learning loop for the fence itself (`cortex-principles` #6 — the model proposes, the human ratifies). Triggered when a deep-scan hit or a no-doc-found lands on something untracked.

**`system_mode: learning`** — put a concrete, answerable proposal to the human, not a vague observation:

> `{path}` looks affected by {change} and isn't tracked. Track it?
> Proposed `REGISTRY.md` `docs.include` entry: `- {path}`

- **Approved** → add the line to `docs.include` (or `docs.flag` if the human wants it watched but never edited). Checked from the next run on. `REGISTRY.md` is seed-once and the human's — never amend it without that approval.
- **Declined** → add the path to `docs.exclude` with a one-line reason, so it stops resurfacing every run. A finding re-raised indefinitely is noise, not learning.
- **Unattended** → log-and-defer as `[needs-human-input]` carrying the proposed line verbatim, ready to approve later.

**`system_mode: production`** — no proposals. Escalate as `[needs-human-input]`: "Structural Mismatch — `{path}` affected but untracked." The human edits `REGISTRY.md`.

Either way: the path is **not** edited in this pass. Tracking is a prerequisite for fixing, not a consequence of it.

---

## `needs-human-input` Handling

Three outcomes, and only these three:

- **Still genuinely open** → remove it from its original position in `LOG.md`, re-verify its citation against the current tree (files move), and re-append it fresh at the end of `LOG.md` with the corrected citation. It must not go missing just because its thread closed.
- **Resolved** — by later work in this thread, by a different not-yet-processed thread, or by this pass's own fix → remove it outright. Cite the evidence from the tree, not the resolving entry's prose.
- **Newly discovered, not previously tracked** → append a fresh `[needs-human-input]` entry to `LOG.md`. Describing it only in AUDITED prose makes it invisible to the next pass: AUDITED is the processing record, LOG is the actionable queue.

Never touch a `needs-human-input` — or any entry — belonging to a thread you are **not** currently processing, even if you read it as supporting evidence. Leave it intact for its own turn.

---

## Marker Policy — `processed LOG through [[…]]`

Threads are pulled oldest-seed-first, not strictly chronologically, so a later-dated thread can close before an earlier-dated one starts. A single boundary timestamp can no longer honestly mean "everything before this is done."

- **While draining a backlog**: do not write or update the marker. `LOG.md`'s own remaining content is the complete and only unprocessed set — that is the source of truth.
- **Once drained** (LOG holds only genuinely recent, un-threaded entries — days, not weeks): resume the marker and return to ordinary small-batch cadence, where entries arrive faster than they cluster into multi-week threads. It is a single line appended to the end of `cortex/AUDITED.md` after the run's last checkpoint, carrying the newest processed entry's timestamp:

  ```
  processed LOG through [[YYYY-MM-DD HH:MM]]
  ```
- **Never half-update it.** A wrong marker is worse than none. If you're deliberately leaving it stale, say so in the checkpoint.

---

## Profile Sync

After drift checks, consult `PROFILE.md` §1 (Switches). For an untracked *doc path*, use § Proposing a New Tracked Path. For anything else structural (a missing category, a missing task folder):
- **Learning Mode**: propose via `[needs-human-input]`, wait for approval.
- **Production Mode**: escalate via `[needs-human-input]`: "Structural Mismatch."

---

## Planning Doc Transition

When processing completion threads, check whether related planning documentation exists. If implementation is complete, decide whether the planning doc should be archived or whether new operational docs are needed.

---

## Follow-up Items

If issues were discovered but not fully resolved, append a new `LOG.md` entry.

---

## AUDITED Maintenance

If entries exceed 100, archive older entries to `cortex/.archive/`.
