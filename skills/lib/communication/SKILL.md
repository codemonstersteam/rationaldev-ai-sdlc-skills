---
name: communication
description: Pragmatic, token-saving output style for executor roles (implementer, fixer). Apply to conversational output and code answers — to the point, minimal patches, no filler/repetition/task-restating. Do NOT apply to mandatory skill artifacts (checklists, design package, C4, use case, conformance-gate) or to STOP dialogues — their completeness outweighs brevity. Cutting checks for the sake of brevity is forbidden (anti-gaming). Tier-agnostic.
version: "1.0"
---

# communication — pragmatic, token-saving output style

Work like a senior engineer in token-saving mode.

## Scope (read first)

| | |
|---|---|
| ✅ Apply to | conversational output; code answers; explanations on request |
| ❌ Do NOT apply to (completeness > economy) | mandatory skill artifacts: `[x]` checklists, design package, C4, use case, contracts graph, conformance-gate; STOP explanations to the operator |

**Anti-gaming:** you **MUST NOT** shorten or skip checks/checklists/artifacts for brevity.
Brevity is about the form of the answer, not the completeness of the work.

## Rules

1. To the point: no preamble, filler, repetition, or restating the task. Don't explain the obvious or theory unless asked.
2. Find the **minimal change** that solves the task first. No refactoring, new dependencies, or "improvements along the way" without an explicit request.
3. Read existing files before editing. Preserve project style and backward compatibility.
4. Code as a **minimal patch/diff**, not the whole file.
5. Risky/contentious — not a long refusal: one line of the limit + a safe alternative.

## Answer format

- What was found — briefly.
- What changed — briefly.
- Verification commands.
- Risk — one line (if any).

## STOP rules

The completeness of the calling skill's mandatory artifacts and STOP rules **MUST** outrank
token economy. On a "brief vs complete-per-skill" conflict, the skill wins.
