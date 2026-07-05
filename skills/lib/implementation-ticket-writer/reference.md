# implementation-ticket-writer · reference — ticket body template (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **когда наполняешь тело тикета** (после того как
> собрал header по контракту в `SKILL.md`): аннотированный шаблон, спец-правило component-тикета,
> foundations. Правила маршрутизации/порядка/STOP — в `SKILL.md`.

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
**Verify:** <unit-test command> for this module; component/smoke (if required) — <the component-test run
  command AS PROVIDED BY THE SCAFFOLDED TEMPLATE, e.g. from its README/scripts> (do NOT hand-probe Docker).
**Acceptance:** unit tests green; the linked component scenario(s) move toward green.
```

**The ticket MUST tell the implementer WHERE and HOW to run tests** (the `Verify` line) — the implementer
must not have to discover the harness. Do **NOT hardcode a path here** (it is template-specific): read the
scaffolded template's convention (README / `scripts/`) and put the **actual** run command into the ticket's
`Verify` line for this project.

**Component-test ticket (stage 5) special rule:** its acceptance MUST include *"all slice component
scenarios tagged `@wip`"* (RED-ready). Removing `@wip` is the **fixer's** slice-acceptance act, not
this ticket's (`component-tests`, `program-implementation`).

**Integration / final ticket special rule (closes the service DoD).** The LAST ticket — the one
`blocked_by` all others that **assembles the service** (entrypoint wiring + docs + deployment) — is NOT
just another module. It **MUST** carry a **DoD-closure checklist**: read the project's Definition-of-Done
(from the FRD / `TASK.md`) and map **every** DoD item → a concrete **deliverable + its exact path**, as an
acceptance checkbox. You **MUST NOT** rely on the implementer to discover DoD gaps (a missed root artifact
becomes a mid-implementation surprise → wasted fixer round).
- **Template-agnostic:** take the items from THIS project's DoD — do **not** hardcode a list.
- **Watch the location trap:** deployment artifacts (root `Dockerfile`, root `docker-compose.yml`) are
  **distinct** from the component-test harness (which lives under `component-tests/`); state the **exact
  target path** for each so the implementer does not confuse them.
- Every DoD item → its own `[ ]` acceptance line with the path; the ticket is done only when all are checked.
- **Number-tag each closure line `DoD-<n>` (MUST — not just a path).** `validate-plan.mjs` checks DoD-closure
  by matching the literal token `DoD-<n>` against the **numbered** `TASK.md §Definition of done` list — a path
  alone does not satisfy it. So write e.g. `- [ ] DoD-3: root Dockerfile at ./Dockerfile`. (This requires
  TASK's Definition-of-done to be a **numbered** list; if it isn't, that's an upstream FRD/TASK defect.)
  The token is the *bridge* between the prose acceptance line and the deterministic gate — omit it and a
  well-formed ticket still bounces to `@linger` as "DoD-замыкание неполно".

## Foundations

Second-planner / context-minimization for weak models (Qwen3.6-27b). Consumes `program-design`
(design package + `io:` field), routes io sub-skills (`http-io`/`llm-client`/`queue-io`/`db-io`/
`db-schema`), hands off to `program-implementation`. Router source: `docs/04_PLANNING_PIPELINE.md` §4.
