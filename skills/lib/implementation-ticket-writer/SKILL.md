---
name: implementation-ticket-writer
description: The SECOND planner — turn the operator-approved design package (program-design) into implementation tickets one at a time, each carrying the MINIMAL atomic context that fits Qwen3.6-27b, with the exact io sub-skills attached by a deterministic router (io: type → skills). Use at stage 11, after Gate #1, to prepare per-module/per-slice tickets an implementer subagent executes independently (tests → module → green → mark done). Do NOT design module trees/contracts (program-design) or write code (program-implementation). Tier-agnostic: io-router table, a minimal-context checklist, STOP.
version: "1.0"
status: "stable"
---

# implementation-ticket-writer — cut Qwen-sized implementation tickets

**In:** the operator-approved (`Gate #1`) design package from `program-design` — slices, module
trees, contracts with `io:`, unit-test formulas, Gherkin-mapping. **Out:** an implementation backlog
where **each ticket is self-contained and fits Qwen3.6-27b** — one ticket = one slice/module = one
implementer subagent. This is the **second planner** (`docs/04_PLANNING_PIPELINE.md` §7): the first
planner *designs*; this pass *packages* the design into minimal-context tickets. It writes tickets —
it does **not** design or implement.

> Companion (read on demand): [`reference.md`](./reference.md) — the annotated ticket-body template,
> the component-test `@wip` special rule, foundations. Read when you fill a ticket body.

## Minimal-context principle (the whole point)

A ticket must carry **only what its module needs**, not the full design package. A Qwen-sized ticket
holds: the module contract (Input/Deps/`io:`/antecedent/consequent), the exact unit-test list (by
formula), the component scenario(s) it must green, the io sub-skill(s) for its `io:`, and its
dependencies — nothing else. If a ticket needs the whole package to be understood, it is too big —
split it (one module / one slice). Do **not** inline entire specs; **link** them and quote only the
module's own rows. Test of a good ticket: an implementer subagent with no other context can complete it.

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
equals** the router output — neither missing nor extra. Over- or under-provisioning is a deterministic **blocker** before Gate #1.

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
blocked_by: [01, 02, 04] # scaffold(01) + component-RED(02, RED-first EDGE) + any module dep(04). May add more.
inputs: [docs/design/slice-02-catalog/contracts.md, api-specification/openapi.yaml]
io: none                # REQUIRED for type: module — none|http|llm|queue|db (router key)
skills: [db-io, db-schema]
---
```

Rules: exactly **one** `scaffold` ticket, and it is `id: 01` with `blocked_by: []` (blocks all others);
every other ticket lists its real prerequisites in `blocked_by` and its real artifact paths in `inputs`
(izi passes exactly these — it does not compute dependencies). `io:` is required only for `module`.
`skills:` is **required on every ticket** and must **exactly equal** the io-router output for its
`type`/`io`. The ticket **body** below the header follows the template in [`reference.md`](./reference.md).

## Ordering & granularity

**Canonical order (contract-first — MUST hold):** component tests come from the **specification**,
BEFORE the modules and their unit tests. Order the backlog exactly:

1. **spec** — OpenAPI/AsyncAPI frozen (stages 3–4; usually already done in the design package);
2. **scaffold** — clone the stack template → runnable placeholder (`service-scaffold`);
3. **component tests (RED)** — realized from the designed scenarios, tagged `@wip` (`component-tests`) — **precedes every module ticket**;
4. **module tickets** — one per module, each carrying **its own unit tests by formula** (io-router applied);
5. **docs** (README) + wiring;
6. component tests turn **GREEN** as the slice assembles → **fixer** removes `@wip`.

**MUST NOT** place the component-tests ticket after the module tickets — component tests are the
executable spec modules are built *against* (RED → GREEN), not a check written after unit tests.

**RED-first is a `blocked_by` EDGE, not just list order (HARD).** «Precedes» above is not enough: every
`module` ticket **MUST** carry the slice's **component-test ticket in its `blocked_by`** — directly, or
transitively through another module that already does. The component test is **not** a code prerequisite of
the module (the reverse is true: the test greens *because of* the module), so it feels wrong to list — but
RED-first requires this edge in the dependency graph so the RED test exists before any module is built.
`validate-plan.mjs` checks the **edge** (`module → component`), not the list position — omit it and the plan
is a **blocker** (this is exactly what bounces to `@linger`; wire the edge here and skip the round).
Anti-example (WRONG): `module` ticket `blocked_by: [01]` (scaffold only). RIGHT: `blocked_by: [01, 02]`
(scaffold + component), or `[03]` where `03` already carries `02`.

- **Dependency order** within modules (a module before its consumers); record `blocked_by`.
- **One ticket = one subagent = one module** (or one small slice). If two modules always change
  together, they may share a ticket; otherwise split.
- Unit tests live **inside each module ticket** (per formula); component tests are their own earlier ticket.

## STOP

- The design package is not operator-approved (Gate #1 not passed) → STOP.
- A module has no `io:` field → STOP, back to `program-design` Step 5 (can't route).
- A ticket won't fit Qwen3.6-27b even after splitting to one module → STOP, report (module too big — a design smell, back to `program-design`).
- Asked to design or to implement here → STOP (wrong role).

## Definition of Done

One ticket per module/slice, dependency-ordered, each self-contained and Qwen-sized; every ticket has
`io:` + the router-attached skills (implementer selects nothing); the component-test ticket carries the
`@wip` acceptance, module tickets carry unit-by-formula; the backlog assembles the whole service →
hand off to `program-implementation`.
