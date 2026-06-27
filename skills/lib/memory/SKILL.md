---
name: memory
description: Working memory of the Ralph Loop cycle in `.agent/memory.md`. Use during IMPLEMENTATION (Implementer/Hughes) and CODE REVIEW/fix (Fixer/Linger) — read at the start of an iteration, rewrite at the end. A live snapshot of state for "future self", NOT an audit log (the audit lives in decisions.log). Do NOT use for compliance traceability or long-lived artifacts. Built for the small/medium tier: what to read/write, STOP rules, checklist.
version: "1.0"
---

# Memory — working memory of the cycle

Agent context is bounded and lost between iterations (model swap, compaction, fresh
run). `.agent/memory.md` is the working handoff of state to "future self" or the next
agent. It answers "where are we and what's next". The "who/what/why" for compliance is
answered by `decisions.log` — memory does NOT replace it.

## When to read and write

- **Start of iteration (FIRST step):** read `.agent/memory.md`. Do not start from
  scratch — continue from the recorded state, accounting for already-rejected approaches.
- **End of iteration (LAST step):** rewrite `.agent/memory.md` to the new state.

## Live snapshot, not a raw log

Memory is **rewritten**, not appended. Keep the current state plus a compressed tail of
rejected approaches. If the file grows linearly with iteration count, it starts eating
the very context it exists to protect.

- **MUST** compress rejected approaches to one line: "tried X → did not work because Y".
- **MUST** drop stale hypotheses and closed blockers.

## What to record

- **State:** what's done, what's left, where you are in the plan.
- **What was tried:** approaches/fixes and the outcome — especially what did **not** work and why.
- **Current hypothesis:** suspected cause of CI failure and the next step.
- **Blockers and open questions.**
- **Links:** PR, iteration number, affected modules/files.

## `.agent/memory.md` template

```markdown
# Memory — <ticket>: <short name>

## State
- Iteration: 3/5
- Done: <...>
- Left: <...>
- Where in plan: <slice/feature toggle>

## What was tried
- <approach> → rejected: <why>
- <fix> → CI red: <which test and why>

## Current hypothesis / next step
- <suspected cause>. Next step: <action>.

## Blockers / open questions
- <OQ-… waiting on human / non-blocking>

## Links
- PR #…, branch …, module …
```

## MUST NOT

- **MUST NOT** put PII/secrets/payment data in memory (see the `security` skill rules).
- **MUST NOT** substitute memory for traceability: decisions still go to `decisions.log`.
- **MUST NOT** keep an append-only log instead of a live snapshot.

## Lifecycle

- Lives in the task branch; on merge it is deleted/archived — not a long-lived artifact.
- On **replanning**, the compressed "What was tried" section is carried to the Planner
  (Wirth) — why we reached replanning.
- The CD analog is `release-health.md` (continuity of the canary loop).

## STOP rules

- Memory not read at the start of the iteration → You MUST stop and read it before changes.
- Memory growing as a raw log → You MUST stop and rewrite it as a live snapshot.
- Secrets/PII found in memory → You MUST stop, scrub them, see `security`.

## Self-check checklist

- [ ] Memory read at the start of the iteration, before changes
- [ ] Memory rewritten (live snapshot), not appended as a raw log
- [ ] Recorded what did **not** work — so it isn't repeated
- [ ] Current hypothesis and next step are explicit
- [ ] No PII/secrets/payment data
- [ ] Decisions duplicated to `decisions.log` (memory does not replace it)
