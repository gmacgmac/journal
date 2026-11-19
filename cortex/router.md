# Cortex — Router

> **Version**: 5.2 · **Managed** · **On-demand** (loaded by a skill or reflex when something
> must be routed — NOT resident every turn).
> Labels in, handler out. It does NOT index skills (skill descriptions do that). It owns only
> what description-matching cannot: the resolution algorithm, safety routes, and the unknown-item
> fallback. Category vocabulary + conventions → `PROFILE.md`. Per-category data + handler links → `REGISTRY.md`.

## What the router owns (and nothing else)
1. **The resolution algorithm** — the one canonical statement of classify → override → default → fallback.
2. **Safety routes** — deterministic; must never depend on a fuzzy description match.
3. **The unknown-item fallback** — the Collaborative Resolution Protocol.

## Safety routes (fire on the rule, never on a description match)
| Trigger | Route |
|---|---|
| Change under `cortex/` or `.kiro/` | **No archive** — git is their history. Edit → bump `Version` → log `[cortex-infra]`. After a `cortex/` change, check whether `cortex/readme.md` needs updating. Never edit `.agent/` or `.claude/` — generated mirrors. |
| Retire / delete existing content | `cortex-archive` skill first |

## Resolution (canonical — the only statement of this algorithm)

For any item to route (a `LOG.md` entry, a Gardener ripple, an inbound file, an explicit request):

1. **Safety first.** If the action *retires* existing content → run `cortex-archive` first, then
   proceed, then log. Modifications under `cortex/` or `.kiro/` are **never** archived — git is
   their history; just log `[cortex-infra]`.
2. **Classify.** System content is matched **by pattern** first (`cortex-change-protocol`
   § System files) → `[cortex-infra]`. Otherwise determine the category by the **longest /
   most-specific path match** in `REGISTRY.md` `categories`, cross-checked against the
   `PROFILE.md` §2 vocabulary. `cortex-infra` and `needs-human-input` are `virtual` — never
   path-matched. Cannot classify → step 5.
3. **Override.** If `REGISTRY.md` `handlers` links a handler for this category/intent → use it.
4. **Default.** Otherwise → the `cortex-garden` drift/ripple check.
5. **Fallback.** Unresolved → Collaborative Resolution Protocol (below). Never silently pick or drop.

> Consumers (skills, rules, docs) reference this section — *"resolve per `router.md` § Resolution"* —
> and MUST NOT restate the algorithm.

## Collaborative Resolution Protocol (the unknown-item fallback)

`[needs-human-input]` is a **recorded outcome, not a wall**. Collaborate to a decision *before*
deferring; log-and-defer only when genuinely unattended (a batch Gardener sweep, no human watching).

- **Interactive** — surface the ambiguity precisely (category? intent? no handler?), then offer:
  **Clarify** (1–2 targeted questions) · **Accept best guess** (note the assumption) ·
  **Defer** (`[needs-human-input]` to `LOG.md`) · **Create a handler** (scaffold from
  `cortex/templates/handler.md`, give it a non-`cortex-` name, link it in `REGISTRY.md`) ·
  **Link an existing handler** (add the `REGISTRY.md` entry). Record the outcome to `LOG.md`.
- **Unattended batch** — append `[needs-human-input]` to `LOG.md` naming the intent/category +
  proposed options, and continue the sweep.

> Grow the system by **linking** handlers in `REGISTRY.md` — never by embedding logic here.
> User-facing intents ("do X") are matched by skill descriptions, not enumerated here.
