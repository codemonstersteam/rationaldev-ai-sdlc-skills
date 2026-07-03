# service-scaffold · planner — pick the template, write the ticket (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **на стадии планирования** (роль, пишущая
> scaffold-тикет): выбрать шаблон по стеку и задать параметры. Роли-исполнители
> (`@scaffolder`/`@hughes`) это НЕ читают — им хватает процедуры в `SKILL.md`.

## Two faces

- **Planner** — picks the template by the service's stack/context and writes the scaffold ticket
  (which template, rename params, deps to expect). One ticket.
- **Implementer** — clones the template and configures it per the ticket (see `SKILL.md`).

This is stage 4b: after the frozen contract (stages 3–4), before component tests are authored
(stage 5). It owns the **whole-repo copy**; the `component-tests` realize half (stage 6) assumes the
skeleton already exists and only makes the designed tests RED.

## Stack router — pick the template by stack (planner, from context)

| Service stack | Template |
|---------------|----------|
| **Go API** | [`codemonstersteam/template-go-api`](https://github.com/codemonstersteam/template-go-api) |
| other stacks | add to the registry as they appear ([`docs/templates/README.md`](../../../docs/templates/README.md)) |

No template for the stack → **STOP**, ask the operator; do not hand-build a skeleton.

## Planner scope

DO:
- Choose the template from the stack router by the service context.
- Write one scaffold ticket: template URL, module path, service name, ports, expected deps.

DON'T:
- Author `.feature` / make tests RED (that is `component-tests`).
- Implement real module logic (that is `program-implementation`).

## What the template ships (implementer copies wholesale, does NOT recreate)

The whole repo: `component-tests/` harness (runner, base steps, compose, `scripts/run-tests.sh`,
green smoke), `cmd/<svc>/main.go` placeholder (`501` except `/health`), `api-specification/`
skeleton, `go.mod`/`Dockerfile`/compose. See `component-tests` for the layout.

## Foundations

Preconfigured stack templates (registry: [`docs/templates/README.md`](../../../docs/templates/README.md)),
`template-go-api` derived from the passkey-demo-api harness. Pairs with `component-tests`
(authoring + RED-ready). Git branching/commit is out of scope here (module-development entry point — TBD).
