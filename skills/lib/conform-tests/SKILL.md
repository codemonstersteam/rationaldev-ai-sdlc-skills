---
name: conform-tests
description: Realize component tests for a change on a FOREIGN repo (built outside the harness) — in the repo's OWN test paradigm (JUnit, pytest, go test, Cargo, …), NOT the harness's Gherkin/Docker/godog. Same semantic core as component-tests (coverage formula 1 + Σ adapter branches, discriminating RED-first, boundaries are unit-level) but the runner, file layout, fixture format and assert helpers are READ from the @surveyor map docs/design/_harness/test-harness.md instead of imposed. Use on the route=foreign lane (mode=foreign) when a change ships discriminating scenarios that must be proven RED in the repo's native suite. Do NOT use for harness-native services/CLI — that is component-tests (Docker Compose + .feature). Do NOT rewrite the repo's test framework or add boundary scenarios (unit-level). Tier-agnostic: formula, conform-not-impose rule, RED-reason table, STOP rules.
version: "1.0"
---

# conform-tests — discriminating tests in the repo's NATIVE paradigm

Realize the component tests of a **foreign-lane** change (`mode=foreign`) **in the repository's own test
runner**, not in the harness's. A foreign repo was built outside the harness — it has JUnit + CSV fixtures, or
pytest, or `go test`, and **no** `.feature`/Docker/openapi. The discipline of the strict `component-tests` skill
is **kept**; its *mechanism* (Gherkin + Docker Compose + godog) is **not imposed**. You **conform** to what the
repo already does.

> **Sibling skill:** `component-tests` (strict lane — Docker Compose + `.feature`, harness-native services/CLI).
> This skill is its foreign twin: identical counting/RED discipline, native mechanism. Never load both for one
> ticket — the ticket's `mode` decides.

## The one source of the repo's paradigm — the @surveyor map (MUST read first)
Everything mechanism-specific comes from **`docs/design/_harness/test-harness.md`** (the `@surveyor` map), never
from guesswork:
- **runner & layout** — framework (JUnit `@SpringBootTest` / pytest / …), where tests live, naming convention;
- **fixture format** — delimiter, header, null convention, value domains, exclusion semantics;
- **assert catalog** — which helper asserts which outcome kind (+ a sibling `file:line` example);
- **sibling index** — which existing test-class demonstrates the convention (read 1–2 neighbours, not the tree);
- **verification command** — how the suite runs (this is the foreign lane's DoD).

**Map absent → STOP: `run @surveyor first`.** You do not reconstruct the paradigm yourself; that is the
surveyor's job, done once per repo.

## The change's scenarios — already designed, discriminating (from @change-intake)
`@change-intake` (foreign) wrote `docs/foreign/<slug>/change-delta.md` with the **affected scenarios** as
`native test-class::method · input · output(current) ≠ output(changed) · assert-helper · RED-reason`. You do
**not** invent scenarios — you **realize** these in the native runner and prove each **RED on the current code**.

## Principle — conform, not impose
- Author each scenario **in the repo's runner**, in the **file/class the map (and the delta) name**, using the
  map's **assert helper** and **fixture format**. Match the neighbours the sibling index points to.
- **Do NOT** introduce Gherkin/`.feature`, Docker Compose, godog/cucumber, an openapi contract, or the harness
  `component-tests/` tree into a foreign repo. **Do NOT** rewrite or "upgrade" the repo's test framework.
- If a discriminating input needs a fixture the repo's format cannot yet express (a missing column/field — a
  **known gap** in the map) → surface it as a **test-harness rework** (back to `@change-intake`/operator), do
  not silently invent an incompatible fixture.

## Coverage — the SAME formula as component-tests (paradigm-independent)
```
N = 1 (happy path) + Σ (distinguishable branches of adapter i)     — per changed behaviour/slice
```
- An **adapter branch** = one externally-distinguishable failure mode the code handles differently. Counting is
  about **behaviour**, not the test framework — it is identical to the strict lane.
- **Boundaries / equivalence classes / input-field choices are UNIT-level** — they belong in the repo's own
  unit tests, never here. A foreign change adds a component test only for a **new/changed distinguishable
  branch**; "more bad data" or "cover logic deeper" is unit-level → do not add it.
- **Extra scenarios MUST be deleted.** The count matches the delta's affected-scenarios exactly.

## RED-first — prove the discriminator on the CURRENT code
Each realized scenario **MUST fail on the current code for the business reason in the delta** (`output(current)
≠ output(changed)`): you assert the **changed** expectation, the current code still produces the **old** output,
so the test is RED. That RED→GREEN *is* the change. RED-reason decision table:

| The test is RED because… | Verdict |
|---|---|
| current code yields `output(current)`, test asserts `output(changed)` (the discriminator) | ✅ correct RED |
| current code yields `output(changed)` already (old == new on this input) | ❌ **degenerate** — test-input rework, back to `@change-intake` |
| compile/setup error, wrong fixture path, missing dependency | ❌ infra-RED — fix the harness wiring, not a real RED |
| asserts an implementation detail, not an outcome | ❌ move to unit level |

A **degenerate** scenario (old == new) is the failure `@change-intake` must catch; if it reaches you, return it
— do not re-assert a literal to force red.

## Realize — drop into the native suite
1. **Read the map + the delta.** Locate the target test-class/file and the assert helper (sibling `file:line`).
2. **Author the fixture** in the repo's format (delimiter/header/null/exclusion per the map) with the
   **discriminating input** from the delta. Reuse the sibling's fixture shape; add only what the input needs.
3. **Write the test method** next to its neighbours, asserting the **changed** expectation via the map's helper.
4. **Run the verification command** (from the map) → confirm the new scenario is **RED for the business
   reason** (not infra). Other tests stay green (you changed no product code).
5. Repeat per affected scenario. Stop at the formula count — no extras.

## STOP rules — ask the operator, do not guess
- **@surveyor map absent** → `STOP: run @surveyor first` (no paradigm to conform to).
- **A scenario cannot be expressed in the native runner** (no matching assert helper, unrepresentable outcome)
  → ask the operator / flag a map gap; do not invent a foreign mechanism.
- **A scenario is degenerate** (old == new on the input) → return to `@change-intake` for a discriminating
  input; do not force red.
- **The change needs a fixture field the format lacks** (map known-gap) → test-harness rework first.

## MUST NOT
Impose Gherkin/`.feature`/Docker/godog/openapi on a foreign repo · rewrite the repo's test framework · add
boundary/equivalence scenarios (unit-level) · assert "it builds/starts" · add "just in case" scenarios · invent
scenarios not in the delta · re-assert a literal to force a degenerate test red.

## Definition of Done
- Every affected scenario from `docs/foreign/<slug>/change-delta.md` has a **native** test, in the class/file
  the map names, using the map's assert helper + fixture format.
- Each is **RED on the current code for its business reason** (RED-reason table = ✅), proven by the map's
  verification command; the rest of the suite stays green.
- The scenario count equals the delta's affected-scenarios (formula `1 + Σ`); no extras.
- No Gherkin/Docker/openapi introduced; the repo's own paradigm is untouched except for the added tests+fixtures.
