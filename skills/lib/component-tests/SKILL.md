---
name: component-tests
description: Design AND realize a program's component tests — a network service (OpenAPI/AsyncAPI) or a CLI tool — as a black box. Two halves — DESIGN (a planner derives the scenario set by formula, Cockburn 1:1, tags @wip) and REALIZE (an implementer drops the designed .feature into the scaffolded skeleton, wires this slice's compose deps/stubs, adds any missing step-definition, proves every scenario RED by business reason). Use when you need new .feature files, more fixtures, a coverage assessment, or to make designed scenarios RED-ready. Do NOT use for unit tests or cross-service contract tests; cloning the skeleton is service-scaffold. Tier-agnostic, written for reliability on weaker tiers: coverage formula (1 + Σ adapter branches; boundaries are unit-level), WIP marker + fixer slice-acceptance, RED-reason decision table, checklists, STOP rules.
version: "1.0"
---

# component-tests — black-box specification

Generate component tests for a program — a network service or a CLI tool. A test is an
**executable specification**: what the program promises on the happy path and on the
failure of each external integration. **Not** bug-hunting, **not** code coverage.

> **Companion files (read on demand, don't preload):**
> - [`realize.md`](./realize.md) — RED-ready **implementation** half: drop the designed `.feature`
>   into the scaffolded skeleton, wire compose deps/stubs, `@wip` marker + fixer slice-acceptance,
>   the **RED-reason decision table**. Read when you realize scenarios, not when you count them.
> - [`reference.md`](./reference.md) — **fixtures** (isolated per slice), file structure, reviewing
>   & extending existing tests, the **pre-commit checklist**, template handoff, worked DB example.
>   Read when you build fixtures, review coverage, or check off before commit.

## Object — the program's spec, black box, in isolation

Test the **program as a black box** (service or CLI — same approach, language/framework
independent): verify the **interface contract**, not the internals. For a service the
contract is OpenAPI/AsyncAPI and the external inputs are endpoints/events; for a CLI tool
the contract is `api-specification/openapi.yaml` (or an equivalent CLI spec) and the
inputs are subcommands.

Isolation is uniform: the whole environment runs in **Docker Compose**. Service — the
service plus its dependencies. CLI — the binary in a container (run as a one-shot compose
service against fixtures) plus its dependencies as compose services, **including a stub of
each external API** (e.g. an LLM endpoint) reached by service name. The stub is a **stub, not a
mock** (Fowler, *Mocks Aren't Stubs*; Meszaros' test-double taxonomy): a real collaborator answering
over the real protocol, never an in-code fake — you verify behaviour through the **real boundary**,
not against a rigged internal double. This choice is fixed: component tests always run in Docker Compose.

## Principle — contract first

Component tests are written before the service code (TDD). Therefore integration failure
modes **MUST** be fixed in the contracts, **MUST NOT** be inferred from adapter code. Code
follows the contract, not the reverse. Failure-mode sources, in priority order:

1. **OpenAPI** (`api-specification/openapi.yaml`) — sync endpoints; all 5xx split by `error.code`.
2. **README `## Карта режимов отказа`** — async integrations and anything not expressed via HTTP codes.
3. **Fallback: adapter code** — only if the contract isn't detailed yet; add a TODO in `backlog.md` to fix the failure modes in the contract.

> `## Карта режимов отказа` is the literal README heading another skill writes — keep it
> in Russian until that chain is translated.

## Boundary with the unit layer

Component tests verify **outward interface promises**: return codes, schema-typed
response/report fields, the reaction to each distinguishable integration failure mode.
They **MUST NOT** re-prove business logic — that's what units in `internal/` do. They also
**MUST NOT** assert build or startup — the compiler proves the build, and the infra-bootstrap
`features/smoke.feature` proves the stack boots. A component scenario asserts a **contract branch**
(an `error.code` / status / field), **never** "the service starts".

Before adding a fixture or scenario, answer: **which new contract branch does it trigger**
— a new `error.code`, `exit` value, status field value, response field, output format, or
CLI flag? If none, it's unit-level — **do not add it**. "Cover logic deeper" or "more bad
data" does not count: the contract distinguishes "blocker / no blocker", not "one failure
vs ten". One **minimal** fixture per contract branch is enough.

**Extra scenarios MUST be deleted**, not kept "just in case". The scenario count **MUST**
match the formula exactly: `N = 1 (happy) + Σ (distinguishable adapter branches)` **per slice**
(1 slice = 1 endpoint); service-wide = the sum over slices = `N_endpoints + Σ branches`. Anything
above the formula signals a fuzzy unit/component boundary.

**`Request`-field branches are units, not components (lesson D1).** A choice by option/flag
(`--out` where to write, `--format` which format) is a pure logic function
(`resolveDestination`, `renderReport` — see `program-design` Step 3, single-request rule)
covered by **units**. The `stdout|file × json|md` matrix adds **no** component scenarios —
only the **write-failure** mode enters a component test.

## Formula

Per slice the count is fixed by the **adapters** (external integrations), **not** by input values:

```
N = 1 (happy path) + Σ (distinguishable branches of adapter i)
```

An **adapter** wraps one external dependency (DB, broker, HTTP provider, filesystem). A
**distinguishable branch** = one error path that adapter surfaces outward and that the service
handles differently (see the distinguishing rule below). Service-wide this sums over all
endpoints/events: `N = N_endpoints/events + Σ adapter branches`. Typical result: **3–6 scenarios
per service** — a small, defensible number. (Source: "Testing mythology: component tests",
codemonsters.team, 2026-04-25.)

**One term, one count.** A *distinguishable adapter branch* ≡ one **failure mode** ≡ one
consumer-visible `error.code` — the same quantity under three names. **1 slice = 1 endpoint**, so per
slice the happy term is `1`; service-wide the count sums over slices → `N_endpoints/events + Σ branches`.

**Boundaries are NOT counted here — they are unit tests.** Input-value boundaries, equivalence
classes, decision tables, and any `Request`-field branch (lesson D1) belong to the **unit** layer
(`program-design` Step 8), never to component tests. Component tests count **adapter branches
only**. This split is a hard invariant of the pipeline ([`docs/04_PLANNING_PIPELINE.md`](../../../docs/04_PLANNING_PIPELINE.md) §5).

**Cockburn Extensions give the wording, not the count.** Each **adapter-failure** Extension → one
component scenario whose name is the Extension's wording verbatim (traceability). An Extension that
is **input validation** (a bad request field) → a **unit** boundary, not a component scenario.

**Gate (per slice):** `#component_failure_scenarios == #distinguishable_adapter_branches == #error.codes of the adapter branches`.
Input-validation Extensions map to unit boundaries instead (their codes are NOT counted here). A scenario without an adapter branch, or an adapter branch without a scenario → a
mismatch you **MUST** fix. Chain: use case → slice → Gherkin → contract-graph nodes.

## What counts as an integration

Leaving the service process: network (HTTP, gRPC, queues, DB via driver), filesystem, IPC.
In-memory libraries are modules, not integrations.

## Generation algorithm

**Step 0 — design failure modes + prepare the runner (if not done).** Before any
`.feature`, these **MUST** exist:
1. 5xx responses with `error.code` in OpenAPI for each distinguishable failure mode;
2. the `## Карта режимов отказа` table in README with the same set;
3. a component-test runner (godog/cucumber/…) with docker-compose, base steps (HTTP, domain auth, integration-failure fixtures), and at least one smoke scenario.

Missing any of the three → Step 1 fails (nothing to check, or nothing to check with).

**Distinguishing rule:** a failure mode is separate if **any** of these four differs from
the integration's other modes — HTTP status (503 vs 507 vs 500); response headers
(`Retry-After` present?); client action (retry / don't / retry with backoff); operator
action (none / alert / escalate). If all four match, the modes collapse into one
`error.code`. (Decide "why this many modes" in `docs/adr/`.)

**Step 1.** Read `api-specification/openapi.yaml`; list endpoints (+ AsyncAPI events).
**Step 2.** One happy-path scenario per endpoint/event. Don't merge two-phase protocols
(e.g. registration: challenge + attestation) into one scenario — they are two contracts.
**Step 3.** Derive failure modes: sync → all 5xx by `error.code`; async → README
`## Карта режимов отказа` rows; fallback → adapter code + TODO.
**Step 4.** One scenario per failure mode.
**Step 5.** Verify `N = N_endpoints/events + Σ (adapter branches)`.

> **Fixtures** for each scenario — design them before the `.feature`; procedure and the
> per-slice isolation rule are in [`reference.md`](./reference.md).
> **Realizing** these scenarios RED-ready in the skeleton (deps/stubs, step-defs, `@wip`,
> RED-reason table) — see [`realize.md`](./realize.md).

## What NOT to do (MUST NOT)

Derive failure modes from code as the primary path · generate request-field validation
scenarios (unit-level) · re-prove business logic · write a **product** launch smoke test (a
business scenario that just asserts the app boots — the compiler + the required infra-bootstrap
`features/smoke.feature` already cover that; the latter is NOT a "smoke test" in this sense) ·
add "just in case" scenarios · merge protocol phases into one scenario.

## STOP rules

You **MUST** stop and ask the operator, don't guess, when:
- the contract (`api-specification/`) is missing but a scenario needs to check against it (response field, `error.code`, `exit`) — nothing to verify;
- you can't map a scenario to a contract branch (the `N` formula) — ask which branch it triggers;
- asked for a "just in case" / "cover logic deeper" / "more bad data" scenario with no new contract branch — don't add it, return to unit level;
- a failure mode isn't reproducible in a test (synthetic, theoretical) — only reproducible modes go in the spec;
- a failure mode exists only in adapter code, not in the contract — fix it in OpenAPI/README (TODO in `backlog.md`) first, then the scenario.
