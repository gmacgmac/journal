# Security Research Methodology

## When to Use

Consult this file whenever a research task carries `research_category: security`, or when the task's content surfaces security concerns even without an explicit category (agent infers — explicit declaration wins, inference is the fallback). Loaded on demand; do not preload for non-security tasks.

This document augments `references/methodology.md` — it does not replace it. The Universal Tenets still apply. The tenets below add a security-specific posture on top.

---

## Security Research Tenets

1. **Adversarial Default** — The null hypothesis is "this is hostile." You earn a PASS; nothing is presumed safe. Reputable author/provenance ≠ safe (cf. supply-chain compromises of trusted maintainers).
2. **Provenance Over Promise** — Claims mean nothing; evidence is everything. A README stating "no telemetry" must be disproven by a network-egress sweep, not trusted. Verify every assertion against the artifact.
3. **Blast-Radius-Before-Depth** — Map the full attack surface first, then drill.
4. **Threat-Model Anchoring** — Every finding cites an attacker + capability + asset. A vulnerability without a threat model is noise.
5. **Fail-Closed Default** — Ambiguous evidence yields a restrictive verdict, not a permissive one. "I couldn't determine X" -> CONDITIONAL, not PASS.
6. **Verdict-Gated Output** — Output is a verdict per in-scope vector plus an overall verdict (PASS / CONDITIONAL / FAIL / REJECT). See Required Output Shape below.
7. **Reproducibility / False-Positive Discipline** — A grep hit is a signal, not a finding. Each finding must reproduce from the cited evidence, and the agent notes the heuristic's likely false-positive rate.
8. **Compensating-Control Awareness** — Rate severity against existing controls. The absence of an expected control is itself a finding.

---

## Threat-Vector Menu

This is a menu, not a checklist. Each task declares which vectors are in-scope. The methodology owns the menu; the task owns the scoping.

### Core (apply to most security audits)

- **Supply chain & provenance** — lifecycle/install scripts, transitive malware, typosquatting, pinning posture, missing SBOM/attestation, registry trust.
- **Code-level injection** — SQL/NoSQL, command/shell, path traversal, XXE, SSTI, unsafe deserialization, LDAP/XPath.
- **Prompt injection / agent integrity** — hidden instructions, Unicode/homoglyph tricks, context-riding payloads, tool-call manipulation, memory poisoning.
- **AuthN & AuthZ** — broken authentication, weak token handling, IDOR, privilege escalation, CSRF, session fixation.
- **Exfiltration & data movement** — network egress, obfuscated channels, secret harvesting, telemetry, env enumeration.
- **Secrets & key management** — hardcoded secrets, secrets in logs, env exposure, rotation gaps.
- **Crypto** — weak/deprecated algorithms, hardcoded keys, IV reuse, TLS misconfig, JWT alg-confusion.
- **SSRF & trust-boundary traversal** — internal/metadata endpoint access, DNS rebinding, open-redirect chains.

### Extended (pull into scope when relevant)

- **Sandbox escape / RCE** — eval/Function/vm escape, prototype pollution, container escape.
- **Misconfiguration & exposure** — debug mode, default creds, exposed admin endpoints, CORS wildcards.
- **PII & data privacy** — PII in logs/examples, data-minimization violations, over-retention.
- **Resource exhaustion / DoS** — ReDoS, unbounded input, memory amplification.
- **Concurrency & state** — TOCTOU races, concurrency auth bypass.
- **Repudiation & audit** — missing/forgeable audit logs.
- **Observability gaps** — no auth-event logging, missing anomaly alerting.

### Adjacent — flag, decide whether in-scope

- **License / legal compliance** — copyleft contamination, license mismatch.
- **Side-channel (timing)** — relevant for crypto/auth comparison logic.

---

## Required Output Shape

Security tasks produce the same research-result file as general research, with one verdict block added on top.

### Verdict Block (mandatory for security tasks)

```
VERDICT (overall): PASS | CONDITIONAL | FAIL | REJECT

Per-vector verdicts:
- <vector name>: PASS | CONDITIONAL | FAIL — one-line rationale

Conditions for adoption (if CONDITIONAL/FAIL):
- <numbered list of what must change before PASS>

Could-not-determine (explicit gaps):
- <what static analysis could not resolve>
```

**Verdict semantics:**
- **PASS** — no in-scope vector produced a finding above threshold.
- **CONDITIONAL** — findings exist but are addressable; adoption viable if conditions are met.
- **FAIL** — unaddressable findings; adoption not recommended without remediation.
- **REJECT** — active malice / supply-chain compromise evidenced; do not adopt.

---

## How This Connects to Execution

1. Task frontmatter includes `research_category: security` (or combined), or the content surfaces security concerns.
2. The `cortex-research` skill Pre-Flight step 3 routes here on demand.
3. Agent applies general Universal Tenets plus security tenets, scopes vectors from the menu, produces verdict-gated output.
4. Execution mechanics (isolation, static-before-dynamic, sandbox tooling) live in the task file's Steps — not here.
