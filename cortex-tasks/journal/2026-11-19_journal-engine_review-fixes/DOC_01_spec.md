# DOC_01_spec: Spec true to the code

> **Parent**: [TASK-STATUS.md](./TASK-STATUS.md)  
> **Plan**: [PLAN.md](./PLAN.md)

---

## Objective

`docs/specification/plugin.md` (and any untrue claim in `README.md` or `skill/SKILL.md`) describes the code as it now is, each claim held to a symbol and a test.

---

## Inputs

- **Files to modify**: `docs/specification/plugin.md`; `README.md` and `skill/SKILL.md` only where a sentence is now untrue.
- **Files to reference**: `git log --oneline -12` and `git diff 54c1d25..HEAD -- src words` (everything since the spec was last true); `docs/handover/print-pattern.md` (print, already written up); BE_01 and FE_01 notes in TASK-STATUS.md.
- **Skills**: `cortex-docs` (follow it: claims tied to a symbol and a named test; destination from REGISTRY `docs`).

---

## Steps

1. [ ] Routes: the `Edit` members (`move`, `remove`, `clear`; `range` for undo), their refusals (`changed`, `order`), the rebuilt spacing; `GET pages` skips a file with only its date line.
2. [ ] The data: entries keep time order when a heading's time changes (engine and bot); a title cannot start like a block (`BLOCKISH_RE`).
3. [ ] The view: the writing's inks a step lighter and the controls in the host's own; hover controls at two strengths, and how they show with no hover; the foot of a day (+ Entry / + Entry with time) and untimed drafts; Start today's page; Remove this day (`host.confirm`, one undo); drag (untimed entries only; keys); an emptied untitled entry goes with its time; `> ` continues a quote; quotes upright.
4. [ ] Print: `host.print` (optional; no control without it), the panel, the three looks, the paper rules; point to `docs/handover/print-pattern.md` rather than repeating it.
5. [ ] The view's use of `host.confirm` (no longer only from `leave()`).
6. [ ] Run the `cortex-docs` audit on what you changed; list each claim's symbol and test in your notes.

---

## Validation

- [ ] Every claim you add names the symbol it describes; each symbol exists (`grep`).
- [ ] No claim about code you did not check.

---

## Implementation Notes

**Status**: Pending  
**Completed**: 

### Changes Made
- 

### Caught Beyond the Brief
- 

### Deviations from Plan
- 
