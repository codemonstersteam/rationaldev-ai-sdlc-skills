# component-tests · reference — fixtures, review, checklists (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **по нужде**: когда конструируешь фикстуры,
> раскладываешь `.feature`-файлы, делаешь ревью/расширение существующих тестов, или сверяешься
> с pre-commit чек-листом перед сдачей. Правила счёта сценариев — в `SKILL.md`.

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

## File structure

One `.feature` per API resource; filename = resource name lowercased; located at
`component-tests/<resource>.feature`.

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

## Pre-commit checklist

- [ ] Step 0 done: integrations and failure modes fixed in OpenAPI and README.
- [ ] `## Карта режимов отказа` in README filled and current.
- [ ] `.feature` files = API resources.
- [ ] happy-path scenarios = endpoints + events.
- [ ] failure scenarios = Σ failure modes from OpenAPI and README.
- [ ] all scenarios run in Docker Compose with real dependencies.
- [ ] no field validation, no business logic, no smoke tests.
- [ ] **fixtures isolated per slice** (`good-<slice>` / `bad-<slice>`); no cross-slice reuse; integration slice has its own.
- [ ] **scenario count = formula** (`1 + Σ adapter branches`); extras deleted; boundaries are unit-level, not here; each scenario triggers exactly one contract branch that didn't exist without it.
- [ ] slice's component scenarios tagged `@wip`; `@wip` removed **only** by the fixer on GREEN at slice completion.

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
