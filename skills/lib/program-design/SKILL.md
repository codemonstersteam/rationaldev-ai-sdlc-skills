---
name: program-design
description: Designing a program by the discipline of rational development. Use when an FRD/task and a frozen API contract (OpenAPI/AsyncAPI) exist and a design package is needed for later implementation (vertical slices, module contracts, antecedents/consequents, unit tests by formula, component scenarios). Do NOT use if the API contract or the README failure-mode map is missing — design them first as a separate task. Tier-agnostic: stepwise steps, router tables, checklists and STOP rules carry the essence without bloat — the optimum, not the minimum.
version: "1.0"
---

# program-design.skill — design a program by the discipline of rational development

## Purpose

The planner's skill. **In:** a functional requirement (FRD, task description).
**Out:** a design package the implementer uses to build the program.

> Roles are work modes, not necessarily different models. One model can play both
> roles in sequence; what matters is the mode switch and the artifact handoff (the
> design package), not a model switch.

Method: vertical slice architecture + structured programming + module contracts +
unit-test formula.

## Scope

DO:
- Design the module schema and contracts.
- Iteratively discuss decision points with the operator.
- Prepare the ticket backlog for the implementer.

DON'T:
- Write implementation code (that's the implementer's job).
- Make architecture decisions without operator approval.
- Add dependencies or technologies without explicit justification.

## Steps

**Step-index (procedure map).** Hold the whole process by this table; if you get lost,
return here, find the current step and open its detail file (`reference/step-NN-*.md`,
map below). Each step's file has its own "In/Out".

| Step | Does | Main out |
|-----|------------|---------------|
| 0 | Check mandatory input artifacts (contract, failure table, Gherkin) | decision "design / stop" |
| 1 | State the task in one phrase | `docs/intent/<slug>.md` |
| 2 | List the external inputs of the slices | slice table |
| 3 | Design each slice's module tree | tree + head-pipe pseudocode |
| 4 | Describe the message catalog | `messages.md` (types, `Result<T, Error>`) |
| 5 | Describe module contracts by template | contracts (Input/Deps/antecedent/consequent) |
| 6 | Isolate I/O into autonomous objects | I/O objects (`Store`/`Client`/`Publisher`) |
| 7 | Describe the app infrastructure module | `infrastructure.md` |
| 8 | Count unit tests by formula + reconcile design with Gherkin | unit-test table + Gherkin-mapping |
| 9 | Reconcile contract consistency via the call graph | `contracts-graph.md` |
| 10 | Assemble the design package | folder `.agent/planner/design/<slug>/` |
| 11 | Build the ticket backlog (one per slice) | `backlog.md` (tickets) |
| 12 | Fill in the handoff checklist | handoff checklist in `backlog.md` |

## Step navigation (progressive disclosure)

Each step's detail lives in its own file — keep only the **current step** in context, not
the whole skill. By the Step-index above, find the step number and open its file:

| Step | Detail file |
|-----|-------------|
| 0 | `reference/step-00-input.md` — check mandatory input artifacts |
| 1 | `reference/step-01-intent.md` — task in one phrase |
| 2 | `reference/step-02-inputs.md` — list slice inputs |
| 3 | `reference/step-03-module-tree.md` — module tree, hard rules, C4, head-pipe pseudocode |
| 4 | `reference/step-04-messages.md` — message catalog + error model |
| 5 | `reference/step-05-contracts.md` — module contracts, `Dependencies:` checklist |
| 6 | `reference/step-06-isolate-io.md` — isolate I/O into autonomous objects |
| 7 | `reference/step-07-infrastructure.md` — app infrastructure module |
| 8 | `reference/step-08-tests-gherkin.md` — unit tests by formula + Gherkin reconciliation |
| 9 | `reference/step-09-contracts-graph.md` — call graph + consistency reconciliation |
| 10 | `reference/step-10-package.md` — assemble the design package |
| 11 | `reference/step-11-backlog.md` — ticket backlog (+ `reference/ticket-template.md`) |
| 12 | `reference/step-12-handoff.md` — conformance-gate + handoff checklist + approval semantics |

## Hard rules and STOP (consolidated — this is the skill's conformance-gate)

`plan-reviewer` checks the design against this list as the reference standard (asymmetry:
do not trust Step 12's self-fill). **Any violation = STOP**, return to the named step,
handoff forbidden. Anti-gaming: you **MUST NOT** tick `[x]` without an existing artifact.
The full text of each rule is in its step's file.

- **Input gate (Step 0).** No contract (`OpenAPI`/`AsyncAPI`), no "failure-mode map" in
  the README, or no Gherkin scenarios for the slice endpoints → design **does not start**.
- **Single `Request` (Step 3, lesson D1).** 1 slice = 1 external input = exactly one
  `Request`; flag/option = a `Request` field; no side-injections past `Request`; no
  test-only I/O method; a branch on a field = logic (unit), not a component scenario.
- **One data argument (Step 3).** Each tree node takes exactly one data entity; 2+ → introduce
  a domain entity and a constructor node `NewT(...)`.
- **Invariant — subtype, not guard (Step 3).** Checking an invariant over a domain struct =
  a subtype constructor, not a guard function `-> ()`.
- **I/O isolation (Step 5/6).** No raw `*sql.DB`/`*http.Client`/broker-conn in
  `Dependencies:` or in the head's `Deps` — only autonomous
  `Store`/`Client`/`Publisher`/`Consumer`/`FileStore`.
- **Head/I/O/adapter are not unit-covered (Step 8.1).** Unit tests only for constructors and
  pure logic functions, by the formula `1 happy + Σ antecedent branches`.
- **UC↔scenario traceability (Step 8.6).** `#Extensions == #failure_scenarios == #error_codes`
  of the slice.
- **Contracts graph consistent (Step 9).** Consequent A ⊆ antecedent B; the types on the
  arrows exist.
- **C4 by levels (Step 3).** C2+C3 in the component (C3 = the module tree), C1 — on the landing.
- **Doc-gate (Step 12).** Package docs — by the `documentation` skill (procedures A/B/C), not
  prose past it.
- **Cross-cutting infrastructure (Step 12, conformance-gate).** Shared egress / shared flags /
  `infrastructure.md` have their own design card and contract and passed every reconciliation —
  they don't "fall between the slices" (the direct root of D1).

## Definition of Done of the skill

- All 12 steps passed.
- Folder `.agent/planner/design/<slug>/` created and filled.
- `backlog.md` contains one ticket per slice.
- **The handoff checklist in `backlog.md` is fully `[x]` (including the last line with the handle and the PR creation date).**
- The design PR is open; operator review awaited. Merging the PR = approval = the implementer may start.
