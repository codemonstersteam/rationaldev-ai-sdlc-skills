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
**Acceptance:** unit tests green; the linked component scenario(s) move toward green.
```

**Component-test ticket (stage 5) special rule:** its acceptance MUST include *"all slice component
scenarios tagged `@wip`"* (RED-ready). Removing `@wip` is the **fixer's** slice-acceptance act, not
this ticket's (`component-tests`, `program-implementation`).

## Foundations

Second-planner / context-minimization for weak models (Qwen3.6-27b). Consumes `program-design`
(design package + `io:` field), routes io sub-skills (`http-io`/`llm-client`/`queue-io`/`db-io`/
`db-schema`), hands off to `program-implementation`. Router source: `docs/04_PLANNING_PIPELINE.md` §4.
