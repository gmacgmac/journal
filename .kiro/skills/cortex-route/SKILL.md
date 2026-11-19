---
name: cortex-route
description: "Route inbound content or a logged change to its handler: retrieve, classify by PROFILE category, resolve the handler per router § Resolution (REGISTRY), then execute or look up. Use for \"route this\", \"process inbound\", \"route the last change\", \"which handler processes X\", or when a file is dropped in cortex/INBOX/."
---

# Route

Route a single item on demand — retrieve it, classify it, find the right handler, and either execute or report.

## Recognised triggers

- "route this" / "route `<path>`"
- "process inbound"
- "route the last change"
- "which handler processes X"
- A file appearing in `cortex/INBOX/`

## Steps

### 1. Retrieve

Resolve what "this" is:

| Source | Resolution |
|--------|-----------|
| `cortex/INBOX/` file | Newest file in the drop zone (or the one named) |
| Pasted / attached content | Use directly |
| Stated path | Read the file |

### 2. Classify

- **Category**: match against `PROFILE.md` §2 vocabulary + the longest path match in `REGISTRY.md` `categories`.
- **Intent**: file new / retire / verify-change / investigate / search / format / unknown.

### 3. Identify handler

**Resolve per `router.md § Resolution`**: safety-first → classify → check `REGISTRY.md`
`handlers` for a category/intent override → else default to the `cortex-garden` drift check
→ else Collaborative Resolution. Do not restate the algorithm; follow § Resolution.

### 4. Act

| Mode | Behaviour |
|------|-----------|
| **Execute** (default) | Invoke the handler. Append the input to `LOG.md`. The handler logs outcomes. |
| **Lookup** ("which handler…") | Report the handler + category as text. Do NOT execute. |
| **Verify a change** ("route the last change") | Single-item on-demand: invoke the `cortex-garden` skill (drift inside the REGISTRY doc surface + ripples routed per category). For a batch sweep, use `cortex-garden` directly. |
| **Ambiguous / no handler** | Apply the **Collaborative Resolution Protocol**: Interactive → clarify / accept-guess / defer / create-handler / link-handler. Unattended → log-and-defer to `LOG.md` as `[needs-human-input]`. Never hard-stop. |

### 5. Report

Brief summary: what it was, which handler, what happened (or, in lookup mode, just the answer).

---

> This skill is the **explicit, triggered** intake path — including for `cortex/INBOX/`. The Gardener (`cortex-garden`) is the batch LOG processor; this handles on-demand single items.
