---
name: component-tests
description: Generate, review and extend a program's component tests — a network service (OpenAPI/AsyncAPI) or a CLI tool — as a black box. Use when you need new `.feature` files, more fixtures, or a coverage assessment against the contract and its failure modes. Do NOT use for unit tests or cross-service contract tests. Tier-agnostic, written for reliability on weaker models: coverage formula, decision tables, checklists, STOP rules.
version: "1.0"
---

# component-tests — black-box specification

Generate component tests for a program — a network service or a CLI tool. A test is an
**executable specification**: what the program promises on the happy path and on the
failure of each external integration. **Not** bug-hunting, **not** code coverage.

## Object — the program's spec, black box, in isolation

Test the **program as a black box** (service or CLI — same approach, language/framework
independent): verify the **interface contract**, not the internals. For a service the
contract is OpenAPI/AsyncAPI and the external inputs are endpoints/events; for a CLI tool
the contract is `api-specification/openapi.yaml` (or an equivalent CLI spec) and the
inputs are subcommands.

Isolation is uniform: the whole environment runs in **Docker Compose**. Service — the
service plus its dependencies. CLI — the binary in a container (run as a one-shot compose
service against fixtures) plus its dependencies as compose services, **including a stub of
each external API** (e.g. an LLM endpoint) reached by service name. The stub is a real
service speaking the real protocol — **never an in-code mock**. This choice is fixed:
component tests always run in Docker Compose.

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
They **MUST NOT** re-prove business logic — that's what units in `internal/` do.

Before adding a fixture or scenario, answer: **which new contract branch does it trigger**
— a new `error.code`, `exit` value, status field value, response field, output format, or
CLI flag? If none, it's unit-level — **do not add it**. "Cover logic deeper" or "more bad
data" does not count: the contract distinguishes "blocker / no blocker", not "one failure
vs ten". One **minimal** fixture per contract branch is enough.

**Extra scenarios MUST be deleted**, not kept "just in case". The scenario count **MUST**
match the formula exactly: `N = N_endpoints/subcommands + Σ failure_modes`. Anything above
the formula signals a fuzzy unit/component boundary.

**`Request`-field branches are units, not components (lesson D1).** A choice by option/flag
(`--out` where to write, `--format` which format) is a pure logic function
(`resolveDestination`, `renderReport` — see `program-design` Step 3, single-request rule)
covered by **units**. The `stdout|file × json|md` matrix adds **no** component scenarios —
only the **write-failure** mode enters a component test.

## Fixtures — isolated per slice

Each slice (subcommand/resource) has its **own** fixtures — `good-<slice>` and
`bad-<slice>`. Fixtures **MUST NOT** be shared across slices: a shared "good" fixture
accumulates the invariants of every registered check at once, so a new slice can silently
make an old fixture no longer "good" for it — hidden coupling that breaks slice
independence. **Exception:** an integration slice that runs all layers at once (e.g.
`assess`) gets its own purpose-built fixture — not a reuse of others'.

A fixture **MUST** be minimal: exactly what triggers one contract branch. Extra content in
`bad-<slice>` makes the failure scenario unreadable — you can't tell which check fired.

**Design the fixture before the `.feature`** (part of design, not debugging):
1. `good-<slice>` — minimal environment where the new check raises nothing; only happy-path content.
2. `bad-<slice>` — add to the minimal base exactly one element that triggers the target failure branch. One element → one branch.
3. Each extra failure branch → a separate `bad` variant or step parameter.

## Formula

```
N = N_API_endpoints + Σ (distinguishable failure modes of integration i)
```

`N_API_endpoints` = OpenAPI endpoints + AsyncAPI events (publish & subscribe); for a CLI,
the number of subcommands. A distinguishable failure mode = each error type the service
promises outward for that integration.

**Failure modes come from the system use-case Extensions (Cockburn).** When the slice's
use case exists (`program-design` Step 8.6), take failure modes 1:1 from its **Extensions**:
`Main Success Scenario` → happy-path scenario; each `Extension NNa` → exactly one failure
scenario (same `error.code` and exit/outcome). So `N = 1 + #extensions` per slice.

**Two-way gate:** `#failure_scenarios == #Extensions == #error_codes` per slice. An
Extension without a scenario, or a scenario without an Extension → a mismatch you **MUST**
fix. Chain: use case → slice → Gherkin → contract-graph nodes.

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
**Step 5.** Verify `N = N_endpoints + N_events + Σ failure_modes`.

## Review and extend existing tests

When the task is "improve test data / coverage" rather than "write from scratch", **invert
the traversal**: go from contract **down** to data, not from data up to "what else to add".
1. List contract items — subcommands/endpoints, schema response fields, `exit` values, CLI flags, `## Карта режимов отказа` rows.
2. For each, find the scenario that triggers it. None → a gap (new scenario/fixture candidate).
3. For each existing scenario, apply the boundary diagnostic. If it triggers no new contract branch → it's a duplicate, unit-level, or a false-useful "debug" assertion (e.g. checking a specific `violation.code` instead of `severity=blocker`).

"More data = better" is the typical review drift. More data helps **only** if it opens a
new contract branch. Narrow per-layer fixtures are justified only when the contract
promises something a broad fixture can't trigger (e.g. `--up-to` with `status="skipped"`
needs a fixture that breaks an early layer but not a late one — a contractual need, not a
desire for depth).

## File structure

One `.feature` per API resource; filename = resource name lowercased; located at
`component-tests/<resource>.feature`.

## What NOT to do (MUST NOT)

Derive failure modes from code as the primary path · generate request-field validation
scenarios (unit-level) · re-prove business logic · write a launch smoke test (the compiler
covers that) · add "just in case" scenarios · merge protocol phases into one scenario.

## STOP rules

You **MUST** stop and ask the operator, don't guess, when:
- the contract (`api-specification/`) is missing but a scenario needs to check against it (response field, `error.code`, `exit`) — nothing to verify;
- you can't map a scenario to a contract branch (the `N` formula) — ask which branch it triggers;
- asked for a "just in case" / "cover logic deeper" / "more bad data" scenario with no new contract branch — don't add it, return to unit level;
- a failure mode isn't reproducible in a test (synthetic, theoretical) — only reproducible modes go in the spec;
- a failure mode exists only in adapter code, not in the contract — fix it in OpenAPI/README (TODO in `backlog.md`) first, then the scenario.

## Pre-commit checklist

- [ ] Step 0 done: integrations and failure modes fixed in OpenAPI and README.
- [ ] `## Карта режимов отказа` in README filled and current.
- [ ] `.feature` files = API resources.
- [ ] happy-path scenarios = endpoints + events.
- [ ] failure scenarios = Σ failure modes from OpenAPI and README.
- [ ] all scenarios run in Docker Compose with real dependencies.
- [ ] no field validation, no business logic, no smoke tests.
- [ ] **fixtures isolated per slice** (`good-<slice>` / `bad-<slice>`); no cross-slice reuse; integration slice has its own.
- [ ] **scenario count = formula**; extras deleted; each scenario triggers exactly one contract branch that didn't exist without it.

**Template handoff (Step 0), if preparing a test template for another agent:**
- [ ] every step in `steps/*.go` is invoked at least once from `features/smoke.feature` — from Gherkin, not a Go macro-call (different arg/parse semantics; "mentally written" steps often fail on first real `.feature` call, e.g. a dynamic id that can't be static in a Gherkin string);
- [ ] smoke is green — full pipeline (`docker compose build → up → run`);
- [ ] the template README lists every step with its regex (a step that can't be one phrase → rename or split);
- [ ] steps for common API cases included: exact JSON-field equality, field presence, non-empty field (for dynamic values like tokens/timestamps) — without them the first JWT endpoint hits a wall.

## Example — service with a DB integration

6 OpenAPI endpoints · 1 integration (embedded SQLite) · 2 distinguishable DB failure modes:
`db_locked` (503 + `Retry-After`, lock contention) and `db_disk_full` (507, disk full). No
AsyncAPI. → `N = 6 + 2 = 8`: eight scenarios fully specify the service as a black box.

`db_unavailable` is deliberately omitted — synthetic for embedded SQLite (would be added
for a networked Postgres/MySQL). Principle: only **reproducible** modes enter the spec, not
theoretical ones.
