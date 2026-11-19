# Research Methodology

## When to Use

Consult this file before executing any task with `type: research`. Apply the Universal Tenets always, then follow the directives for the task's `research_category`.

---

## Universal Tenets

1. **Adversarial Completeness** — After your first pass, ask "what did I miss?" Actively try to disprove your own findings before declaring done.
2. **Multi-Source Triangulation** — Cross-reference: source code, documentation, runtime behaviour (logs/config), and external references (specs, RFCs, vendor docs). No single source is authoritative alone.
3. **Blast Radius Before Depth** — Map the full surface area first (breadth), then drill into each zone. Prevents tunnel-vision on one area while missing three others.
4. **Evidence-Linked Findings** — Every claim cites: file path + line, log output, config value, or external URL. No "I believe..." — only traceable evidence.
5. **Assumption Surfacing** — Name assumptions explicitly. "This conclusion assumes X. If X changes, the finding inverts."
6. **Diminishing Returns Awareness** — Deep does not mean infinite. When additional investigation yields no new information, declare the area "saturated". Document what you didn't explore and why.
7. **Layered Output** — Produce three layers: (a) executive summary (3 sentences), (b) structured findings table, (c) full evidence appendix.

---

## Research Categories

Set `research_category` in task frontmatter. Multiple allowed.

### `code-change`

> "What exists, what changes, what breaks?"

Researching how to implement, replace, or refactor something in the codebase.

**Directives:**
- Map all call-sites and consumers of the target code before proposing changes.
- Identify shared interfaces — changes here ripple to every consumer.
- Classify blast radius: `local` (one module, no API change) vs `cross-module` (spans modules, or breaks an interface).
- Check for existing tests that would break or need updating.
- Surface any circular dependencies the change introduces.
- Output must include: files-affected table, breaking-change assessment, recommended task ordering.

### `doc-sync`

> "What's stale, what's missing, what's wrong?"

Determining what documentation needs updating after a change or proactively.

**Directives:**
- Diff current docs against actual code/config behaviour.
- Check `REGISTRY.md` `docs` for authoritative doc mappings.
- For each stale doc: cite the specific line(s) that diverge and what the correct state is.
- Flag docs that reference removed/renamed files, deprecated config fields, or dead links.
- Output must include: stale-docs table (doc path, what's wrong, evidence), priority ranking.

### `feasibility`

> "Can we do this? What are the blockers and trade-offs?"

Evaluating whether something is achievable within current constraints.

**Directives:**
- Define success criteria before investigating (what would "feasible" look like?).
- Identify hard constraints (platform limits, security model, dependencies) vs soft constraints (effort, complexity).
- For each blocker: classify as `hard` (cannot work around) or `soft` (workaround exists, state cost).
- Research prior art — has this been attempted before in this codebase or similar systems?
- Output must include: feasibility verdict (go/no-go/conditional), blockers table, trade-off matrix.

### `integration`

> "What are the touch points, dependencies, and ripple effects?"

Understanding how a feature hooks into the existing platform.

**Directives:**
- Trace the data/control flow from entry point to final effect.
- Identify every module/service the integration touches.
- Map configuration surface: what new config fields, env vars, or DB changes are needed?
- Check for ordering dependencies (must X exist before Y can work?).
- Identify observability gaps — will we know if this breaks silently?
- Output must include: integration map (component -> touch point -> effect), dependency graph, config surface list.

### `spike`

> "Which of N paths actually works? Prove it empirically."

Comparative testing of multiple approaches against acceptance criteria.

**Directives:**
- Define acceptance criteria before testing any candidate.
- Each candidate gets a standalone spike file: hypothesis, test method, result (pass/fail), evidence.
- Test candidates in isolation — don't let findings from one contaminate another.
- Explicitly declare what's "proven in test" vs "assumed to work in production".
- Architecture recommendation comes after ALL spikes close, not during.
- Dropped/failed candidates are preserved (archive, don't delete) with reasons.
- Output must include: spike summary table, architecture recommendation with decision record, superseded candidates list.

### `security`

> "Is this safe to trust, adopt, or expose?"

Security vetting. Tenets, a threat-vector menu, and verdict-gated output live in `references/security-methodology.md` to avoid polluting general-research context. The Universal Tenets still apply; the security doc layers on top. See that file for full detail.

---

## Connecting to Execution

1. Task frontmatter includes `research_category: <category>` (or multiple: `[spike, integration]`).
2. Agent reads this methodology file, applies Universal Tenets + category directives.
3. If `research_category` includes `security`, or the task surfaces security concerns, also read `references/security-methodology.md`.
4. Agent follows the `cortex-research` skill body for execution mechanics and output format.
5. Findings conform to the category's required output structure.
