---
name: implementation-ticket-writer
description: The SECOND planner — turn the operator-approved design package (program-design) into implementation tickets one at a time, each carrying the MINIMAL atomic context that fits Qwen3.6-27b, with the exact io sub-skills attached by a deterministic router (io: type → skills). Use at stage 11, after Gate #1, to prepare per-module/per-slice tickets an implementer subagent executes independently (tests → module → green → mark done). Do NOT design module trees/contracts (program-design) or write code (program-implementation). Tier-agnostic: io-router table, a minimal-context checklist, STOP.
version: "0.1"
status: "draft"
---

# implementation-ticket-writer — cut Qwen-sized implementation tickets

## Purpose

**In:** the operator-approved design package (`program-design`: slices, module trees, contracts
with the `io:` field, unit-test formulas, Gherkin-mapping) after **Gate #1**. **Out:** an
implementation backlog where **each ticket is self-contained and fits Qwen3.6-27b** — one ticket =
one slice/module = one implementer subagent.

This is the **second planner** (`docs/04_PLANNING_PIPELINE.md` §7): the first planner *designs*;
this pass *packages* the design into minimal-context tickets so a weak model succeeds without
re-reading the whole package. It writes tickets — it does **not** design or implement.

## Minimal-context principle (the whole point)

A ticket must carry **only what its module needs**, not the full design package. A Qwen-sized ticket
holds: the module contract (Input/Deps/`io:`/antecedent/consequent), the exact unit-test list (by
formula), the component scenario(s) it must green, the io sub-skill(s) for its `io:`, and its
dependencies — nothing else. If a ticket needs the whole package to be understood, it is too big —
split it (one module / one slice).

Do **not** inline entire specs; **link** them and quote only the module's own rows. The test of a
good ticket: an implementer subagent with no other context can complete it.

## io-router — attach skills by the module's `io:` (deterministic)

The `io:` field (set by `program-design` Step 5) is the sole routing key — no judgement:

| module `io:` | Skills attached to the ticket |
|--------------|-------------------------------|
| `none`  | `program-implementation` (+ `program-design` contract excerpt) |
| `http`  | + `http-io` |
| `llm`   | + `http-io` + `llm-client` |
| `queue` | + `queue-io` |
| `db`    | + `db-io` + `db-schema` |

The implementer subagent receives exactly these — it **selects nothing**. A module with `io: none`
gets no io sub-skill.

## Ticket template (minimal, Qwen-sized)

Reuse the `program-design` ticket template (`reference/ticket-template.md`) but **trim to this
module's rows**. Each ticket carries:

```
### TICKET S<n>.<m> — <slice>/<module>: <one-line what>

**io:** <none|http|llm|queue|db>   →  skills: <from the router>
**Context (only this module):**
- contract: <Input / Deps / antecedent / consequent> (from the design card)
- unit tests: <N by formula> — <list the pure logic/constructors; I/O & head NOT unit-covered>
- component scenario(s) to green: <names> (verbatim from the .feature)
**Dependencies:** <which earlier tickets' types/objects it imports>
**Subagent instruction:** write the unit tests → implement the module → run tests →
  green? mark this ticket done in the plan. Do not touch other modules.
**Acceptance:** unit tests green; the linked component scenario(s) move toward green.
```

**Component-test ticket (stage 5) special rule:** its acceptance MUST include *"all slice component
scenarios tagged `@wip`"* (RED-ready). Removing `@wip` is the **fixer's** slice-acceptance act, not
this ticket's (`component-tests`, `program-implementation`).

## Ordering & granularity

- **Dependency order** (a module before its consumers); record `Blocked by`.
- **One ticket = one subagent = one module** (or one small slice). If two modules always change
  together, they may share a ticket; otherwise split.
- The final tickets assemble the service brick by brick; the **fixer** runs the slice component
  tests on completion and removes `@wip`.

## STOP

- The design package is not operator-approved (Gate #1 not passed) → STOP.
- A module has no `io:` field → STOP, back to `program-design` Step 5 (can't route).
- A ticket won't fit Qwen3.6-27b even after splitting to one module → STOP, report (the module is
  too big — a design smell, back to `program-design`).
- Asked to design or to implement here → STOP (wrong role).

## Definition of Done

- One ticket per module/slice, dependency-ordered, each self-contained and Qwen-sized.
- Every ticket has `io:` + the router-attached skills; the implementer selects nothing.
- Component-test ticket carries the `@wip` acceptance; module tickets carry unit-by-formula.
- The backlog assembles the whole service; hand off to `program-implementation`.

## Foundations

Second-planner / context-minimization for weak models (Qwen3.6-27b). Consumes `program-design`
(design package + `io:` field), routes io sub-skills (`http-io`/`llm-client`/`queue-io`/`db-io`/
`db-schema`), hands off to `program-implementation`. Router source: `docs/04_PLANNING_PIPELINE.md` §4.
