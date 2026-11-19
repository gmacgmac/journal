---
name: cortex-research
description: "Investigate a question and produce findings WITHOUT changing code — research, then write a result file. Use when asked to research, investigate, compare, or analyze before any implementation."
---

# Research

Execute a research task: investigate, produce findings, write a result file. No source code changes.

## Overview

A research task produces a **research result file** — a self-contained document of findings, evidence, and recommendations. You write no source code. You modify no application files. The output is a result file only. Next steps are determined by the user after reviewing findings.

---

## Pre-Flight

1. Read the research task file — note its Research Objectives, Steps, and Constraints.
2. Consult `references/methodology.md` — apply Universal Tenets + the directives for the task's `research_category` (from frontmatter).
3. If security-relevant, consult `references/security-methodology.md` — applies when `research_category` includes `security` OR the task content surfaces security concerns. Load on demand; do not preload for non-security tasks.
4. Confirm research mode: the task has `type: research` and an explicit "DO NOT implement" constraint.
5. Choose execution mode: sub-agent (preferred) or direct (fallback).
6. Brief the user: "Starting research task [task_name]. Category: [research_category]. Mode: [sub-agent/direct]."

---

## Delegation Strategy

Research tasks involve heavy file reading and grep audits — work that pollutes context if done inline.

### Preferred: Delegate to a Sub-Agent

If your environment exposes a specialized research/context-gathering sub-agent, use it. Otherwise use your environment's general-purpose sub-agent. It reads files, runs greps, returns structured findings. Main context stays clean.

### Fallback: Direct Execution

If no sub-agent is available: read the task's Steps, execute directly using read/grep tools. Be deliberate about what you read — don't over-fetch. **Long File Strategy applies here too**: when writing the result file, if it exceeds 50 lines, CREATE then APPEND in chunks.

In either case, the output shape is identical.

---

## Execution

### Sub-Agent Delegation

Invoke the chosen sub-agent with the research task file as contextFile. Prompt:

```
Execute the research task in the provided file. Follow its Research Objectives and Steps exactly.

Rules:
- RESEARCH ONLY. Do NOT modify any source files.
- Do NOT create implementation tasks — return findings only.
- Do NOT log to LOG.md — the orchestrator handles that.
- Be precise: include file paths, line numbers, exact snippets where relevant.
- MANDATORY Long File Strategy: any file write >50 lines MUST be CREATEd then APPENDed in chunks.

Return Contract:
---
RESEARCH_TASK: <task file path>
STATUS: COMPLETED | BLOCKED
FINDINGS: <structured prose, one section per Research Objective>
BLAST_RADIUS: <files affected, classified as local/cross-module>
RECOMMENDATIONS: <numbered list of recommended next steps>
ASSUMPTIONS: <explicit assumptions underpinning the findings>
NOTES: <anything the orchestrator needs to know>
---
```

Parse the structured block. Do not re-read files the sub-agent already audited.

### Direct Execution

Walk the task's Steps in order. Read only what's necessary. Build findings internally.

---

## Output

### 1. Update the Research Task File
Replace its Findings section with actual findings. Update frontmatter: `status: completed`, `completed: YYYY-MM-DD`. Tick success criteria.

### 2. Write the Research Result File
Same directory as the task, named `{filename-stem}_result.md`. Contains: executive summary, structured findings (per objective), blast radius, recommendations, assumptions, evidence appendix. This is the deliverable — self-contained and readable alone.

### 3. Log
Append to `LOG.md`: `[[YYYY-MM-DD HH:MM]] [CATEGORY] Completed: <task name> research -> Task: [[<path>]]`

Use the category from the research task's frontmatter.

---

## Precedence

The research task file is authoritative. If it defines output filename, format, destination, or constraints, those override the defaults in this skill.

---

## Constraints

- No source code changes. Only the research task file and result file are touched.
- No implementation task creation — that is a separate decision after user review.
- Collaborate with user if: the research surfaces a semantic divergence, a circular dependency, or the blast radius exceeds what the task anticipated.

---

## On Completion

Brief status to user:
```
✓ Research complete. Findings in <task file>. Result file at <path>. LOG.md updated. Awaiting your decision on next steps.
```

Keep summaries short — full detail lives in the result file.

---

## Key Principles

- Research produces findings, not plans. Next steps are the user's call.
- Sub-agent for heavy reading when available. Main context is precious.
- The result file must stand alone — readable without the original task.
- No code, no exceptions. If you want to "just fix that one thing", note it in recommendations instead.
