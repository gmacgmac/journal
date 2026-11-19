---
inclusion: always
---

> **Version**: 3.0 | **Updated**: 2026-07-17

## Routing Rule

`cortex/PROFILE.md` §2 (the category vocabulary) is **resident**. `cortex/router.md`
(the resolution mechanics) and `cortex/REGISTRY.md` (category paths + handlers) are
**on-demand** — load them the moment you must classify or route an item. Whenever you route,
**resolve per `router.md § Resolution`** — never guess a skill, and never restate the algorithm.

### Keyword triggers (explicit user routing requests → run `/cortex-route`)

| User says | Mode | Action |
|---|---|---|
| `route this` / `route <path>` / `route this data` | execute | classify → find handler → run it |
| `process inbound` | batch | sweep `cortex/INBOX/`, route each file |
| `route the last change` (or `verify this`) | execute | single-item drift/ripple check via the Gardener |
| `which skill handles X` / `what handles X` | lookup only | answer in text — do **not** execute |

### Implicit routing (no keyword needed)

Some mechanisms route without a user utterance — they load `router.md` + `REGISTRY.md` when they fire:
- Before modifying a `cortex/` or doc-surface file → `cortex-change-protocol.md` sends you to `router.md` + `REGISTRY.md`.
- A logged change needs verification / ripples → the Gardener resolves each `LOG.md` item per `router.md § Resolution`.

### Ambiguity & fallback

When classification/routing is ambiguous or there's no handler, follow the **Collaborative
Resolution Protocol** in `router.md` (interactive menu, or log-and-defer when unattended).
`[needs-human-input]` is a recorded outcome, not a wall. **Never silently pick or drop.**
