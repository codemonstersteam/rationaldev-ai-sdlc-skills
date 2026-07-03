---
name: implementation-ticket-writer
description: The SECOND planner — turn the operator-approved design package (program-design) into implementation tickets one at a time, each carrying the MINIMAL atomic context that fits Qwen3.6-27b, with the exact io sub-skills attached by a deterministic router (io: type → skills). Use at stage 11, after Gate #1, to prepare per-module/per-slice tickets an implementer subagent executes independently (tests → module → green → mark done). Do NOT design module trees/contracts (program-design) or write code (program-implementation). Tier-agnostic: io-router table, a minimal-context checklist, STOP.
version: "1.0"
status: "stable"
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

The ticket's machine-readable **`skills:` field carries exactly these io add-ons** (the core
`program-implementation`/`code-style`/`communication`/`memory` is always loaded, so it is NOT listed).
By ticket **type**: `scaffold` → `[service-scaffold]`; `component` → `[component-tests]`; `module` →
the io-router row above (`none` → `[]`). `harness/validate-tickets.mjs` enforces `skills:` **exactly
equals** the router output — neither missing nor extra — so the implementer receives precisely the
skills it needs and nothing more. Over- or under-provisioning is a deterministic **blocker** before Gate #1.

**`io: http`/`queue` are OUTBOUND only.** They tag an autonomous `Client`/`Publisher`/`Consumer` the
service *calls out* to. The service's own **inbound** HTTP handler / ingress adapter is `io: none` —
never route `http-io` to it. If the module has no outbound call, its `io:` is `none`.

## Mandatory machine-readable header (MUST — the router's contract)

Every ticket file `tickets/NN-*.md` **MUST start** with a strict YAML front-matter header so the
orchestrator (`izi`) can route **mechanically** without reading the body. Use **flow arrays** `[a, b]`
(the harness YAML parser does not read block `- ` lists). Missing/broken header = **blocker** at review
(`harness/validate-tickets.mjs` enforces it deterministically before Gate #1):

```yaml
---
id: 05
type: module            # scaffold | component | module
slice: slice-02-catalog
blocked_by: [01, 04]    # ids of prerequisite tickets (may be [])
inputs: [docs/design/slice-02-catalog/contracts.md, api-specification/openapi.yaml]
io: none                # REQUIRED for type: module — none|http|llm|queue|db (router key)
skills: [db-io, db-schema]
---
```

Rules: exactly **one** `scaffold` ticket, and it is `id: 01` with `blocked_by: []` (blocks all others);
every other ticket lists its real prerequisites in `blocked_by` and its real artifact paths in `inputs`
(izi passes exactly these — it does not compute dependencies). `io:` is required only for `module`.
`skills:` is **required on every ticket** and must **exactly equal** the io-router output for its
`type`/`io` (validated deterministically) — this is how the implementer gets only the skills it needs.

## Ticket template (minimal, Qwen-sized) — body after the header

Reuse the `program-design` ticket template (`reference/ticket-template.md`) but **trim to this
module's rows**. Each ticket carries (below the header):

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

**Canonical order (contract-first — MUST hold):** the component tests come from the **specification**,
BEFORE the modules and their unit tests. Order the backlog exactly:

1. **spec** — OpenAPI/AsyncAPI frozen (stages 3–4; usually already done in the design package);
2. **scaffold** — clone the stack template → runnable placeholder (`service-scaffold`);
3. **component tests (RED)** — realized from the designed scenarios, tagged `@wip`
   (`component-tests`) — **this ticket precedes every module ticket**;
4. **module tickets** — one per module, each carrying **its own unit tests by formula** (io-router applied);
5. **docs** (README) + wiring;
6. component tests turn **GREEN** as the slice assembles → **fixer** slice-acceptance removes `@wip`.

**MUST NOT** place the component-tests ticket after the module tickets — component tests are the
executable spec the modules are built *against* (RED → GREEN), not a check written after unit tests.

- **Dependency order** within modules (a module before its consumers); record `Blocked by`.
- **One ticket = one subagent = one module** (or one small slice). If two modules always change
  together, they may share a ticket; otherwise split.
- Unit tests live **inside each module ticket** (per formula); component tests are their own earlier
  ticket. Never fold "write unit tests" before "write component tests" in the backlog order.

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
