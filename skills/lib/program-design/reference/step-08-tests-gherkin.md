<!-- program-design · step 08 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 8. Design the tests and reconcile the design with the Gherkin scenarios

**In:** the module contracts + Gherkin scenarios. **Out:** the unit-test table by formula + each slice's Gherkin-mapping.

The step has two parts: count the unit tests by formula and **reconcile back** the slice design
against the already-written Gherkin scenarios (see Step 0 — they're mandatory on input).

#### 8.1. Unit tests of logic modules

For each **logic** module (domain-struct constructors and pure functions over them):

```
N_unit_tests = 1 (happy path) + Σ (antecedent branches)
```

**Branches on a `Request` field — here.** Pure choice functions (`resolveDestination`,
`renderReport` — Step 3, single-request rule) are counted by the same formula: the matrix
`stdout|file × json|md` is covered by **units**, **not** component scenarios (otherwise the
component count `1 + Σ adapter branches` (Step 8.6) bloats with non-adapter cases).

**Hard rule: the head module, the I/O modules and the ingress adapter are not unit-covered.**

The head module is an **orchestrator pipe** of already-tested parts. A unit test over it would be
an integration test (the pipe assembles real dependencies). Its correctness and all I/O error
branches are proven by component scenarios through the slice's real input (see Step 3, "The head
module — an orchestrator pipe").

I/O modules are essentially **pipes** — moving bytes between the process and an external
dependency (DB, broker, external API). No business logic, nothing to test. A "unit test" against
a `:memory:` DB is a small integration test, not a unit.

Ingress adapter: parses input, maps errors into the response format — no algorithm to verify
with a unit.

What checks **what**:

| Artifact                          | Unit test                                | Component (Gherkin)                                                  |
|-----------------------------------|------------------------------------------|--------------------------------------------------------------------------|
| Domain-struct constructor         | yes, by formula                          | indirectly, through the happy path                                       |
| Pure logic function               | yes, by formula                          | indirectly, through the happy path                                       |
| **Slice head module**             | **no** (pipe; unit = integration test)   | **yes**, happy path + all I/O error branches via failure scenarios       |
| **I/O module (Success branch)**   | **no**                                   | **slice happy-path scenario** (if the write doesn't land — Gherkin red)  |
| **I/O module (Failure branches)** | **no**                                   | **failure scenario** of the slice the failure mode is tied to by the distinguishability rule |
| **Ingress adapter (parsing)**     | **no**                                   | **happy + error scenarios** (through the real HTTP input)                |

#### 8.2. Anti-example — how not to

```
| Module                       | Happy | Branches              | Total |
|------------------------------|-------|-----------------------|-------|
| persistRegistrationSession   | 1     | duplicate UUID (UNIQUE) | 2   |   ← NOT ALLOWED
```

I/O in the unit-test table — stop, delete the row. A duplicate UUID is SQLite behavior, not a
constructor antecedent; it's checked by a component scenario, or accepted as impossible by
construction (a UUID v4 from `crypto/rand` doesn't collide).

#### 8.3. Component scenarios — already written

For the slice as a whole, the Gherkin component test **already exists** by Step 8 (Step 0
guarantees it):

- 1 happy-path scenario;
- a scenario per distinguishable failure mode of the slice's I/O modules (distinguishability rule
  — see `component-tests`).

The planner doesn't write them — uses them as the source of truth.

#### 8.4. Gherkin ↔ slice modules reconciliation table

This is Step 8's main artifact. Goal — for **each** Then-step of **each** Gherkin scenario of the
slice, explicitly name the call-graph node (see Step 9) that greens that Then. If a Then-step
ties to no node — the slice design is incomplete, return to Step 3.

The table goes in the slice card
(`.agent/planner/design/<slug>/slices/<n>-<name>.md`), section `## Gherkin-mapping`. Format:

| Scenario                         | Then-step                                          | Provided by (graph node / adapter mapping) |
|----------------------------------|---------------------------------------------------|--------------------------------------------------|
| happy: successful registration   | response 201 + `challenge`                         | head → `buildResponse`                            |
| happy: successful registration   | challenge saved to DB                              | I/O `persistChallenge` (Success branch)           |
| happy: successful registration   | event `registration_started` published            | I/O `publishRegistrationStarted` (Success branch) |
| db_locked: SQLITE_BUSY           | response 503 + `Retry-After` + `error.code=db_locked` | I/O `persistChallenge` (Failure: ErrDBLocked) → ingress adapter: map ErrDBLocked → 503 |
| db_locked: SQLITE_BUSY           | challenge **not** saved                            | precondition to I/O `persistChallenge` (transaction atomicity) |
| db_disk_full                     | response 507 + `error.code=db_disk_full`           | I/O `persistChallenge` (Failure: ErrDiskFull) → ingress adapter: map ErrDiskFull → 507 |

One Then-step — one table row. If one Then appears in several scenarios — repeat the row (don't
collapse), so editing one scenario doesn't touch another.

#### 8.5. Reconciliation checklist

For each table row check:

1. **The node exists.** The named module/mapping is described in Step 5 (contracts) and will
   appear in the graph in Step 9.
2. **The branch matches.** If the Then expects an error — the node must have a corresponding
   Failure path with the same error class. If the Then expects an integration effect — the node
   must be an I/O module with that effect.
3. **The adapter response format is consistent.** If the Then checks an HTTP code, a header
   (`Retry-After`), an `error.code` in the body — the slice card records the mapping of the
   error class into that format, or the ingress adapter delegates it to a shared helper from
   `infrastructure.md`.
4. **All Thens covered.** Walked all the slice's Gherkin scenarios — no `.feature` line is left
   without an entry in the table.

If any item mismatches — **return to Step 3** (module tree) or **Step 5** (contracts), fix,
re-run 8.4–8.5.

Step 8 is done when the table is filled, all four checklist items are closed, and the slice card
explicitly carries `[x] Gherkin-mapping reconciled`.

#### 8.6. Traceability use case → slice → component test

The system **Cockburn use case** (C4 level, Step 3 / `documentation` skill Pass B4) is stitched
to the slice and tests deterministically:

- **1 vertical slice = 1 external input = 1 use case.**
- **Main Success Scenario → 1 happy-path Gherkin scenario.**
- **Each Extension `NNa` is one of two kinds** and routes to the layer that owns it:
  - **I/O-adapter failure** (a distinguishable failure of an external dependency: DB / broker /
    HTTP) → **1 component failure scenario**, carrying an error code (Step 4) and the outcome.
  - **Input validation** (a bad `Request` field / a domain-constructor antecedent) → a **unit
    boundary** (Step 8.1, D1.2), **not** a component scenario.
- Component-scenario formula matches `component-tests`: **`N_scenarios = 1 + Σ (distinguishable
  I/O-adapter branches)`** — counted by **adapters**, not by `#extensions`. Input-validation
  extensions are covered by **units** (their boundaries) and never inflate the component count.
- Each `Then` → a graph node (table 8.4).

**Gate reconciliation (both ways):**

1. Each **I/O-adapter** Extension has a component failure scenario, and each component failure
   scenario has a corresponding I/O-adapter Extension.
2. Each **input-validation** Extension has a unit boundary (Step 8.1) — every boundary covered.
3. `#component_failure_scenarios == #distinguishable_I/O-adapter_branches == #consumer-visible_error_codes`
   for those branches.

**Anti-gaming:** you can't delete a component scenario without deleting the corresponding adapter
branch/Extension (and vice versa); you can't move a boundary from a unit into a component scenario
to "prove more". A counter mismatch → **STOP**, return to Step 3 or the use case. Source for
`component-tests` (`1 + Σ adapter branches`) and consumer of the error dictionary (Step 4).
