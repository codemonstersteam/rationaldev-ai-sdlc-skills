---
name: service-scaffold
description: Start a service from a preconfigured stack template (copy — then work). Two faces — the PLANNER picks the template by stack/context and writes a scaffold ticket; the IMPLEMENTER clones and configures the template per that ticket, yielding a runnable placeholder service (builds, /health green, 501 elsewhere) BEFORE tests are authored. Use at stage 4b, after the contract is frozen and before component-tests. Do NOT hand-assemble a runner (that defeats the template) or make tests RED-ready (that is component-test-scaffold) or implement logic (program-implementation). Tier-agnostic: stack router, a clone-and-configure checklist, STOP.
version: "1.0"
status: "stable"
---

# service-scaffold.skill — start a service from a stack template

## Purpose

Turn "start a new service" into a **scaffold ticket** executed against a **preconfigured stack
template** (copy — then work). **Out:** a runnable **placeholder service** repo — it builds,
`/health` returns 200, every other route returns `501` — the base the later stages fill in.

Two faces:
- **Planner** — picks the template by the service's stack/context and writes the scaffold ticket
  (which template, rename params, deps to expect). One ticket.
- **Implementer** — clones the template and configures it per the ticket.

This is stage 4b: after the frozen contract (stages 3–4), before component tests are authored
(stage 5). It owns the **whole-repo copy**; `component-test-scaffold` (stage 6) assumes the skeleton
already exists and only makes the authored tests RED.

## Stack router — pick the template by stack (planner, from context)

| Service stack | Template |
|---------------|----------|
| **Go API** | [`codemonstersteam/template-go-api`](https://github.com/codemonstersteam/template-go-api) |
| other stacks | add to the registry as they appear ([`docs/templates/README.md`](../../../docs/templates/README.md)) |

No template for the stack → **STOP**, ask the operator; do not hand-build a skeleton.

## Scope

DO (planner):
- Choose the template from the stack router by the service context.
- Write one scaffold ticket: template URL, module path, service name, ports, expected deps.

DO (implementer):
- Clone the chosen template wholesale; configure it per the ticket; keep the placeholder behavior.

DON'T:
- Rebuild the runner or compose by hand (copy the template).
- Author `.feature` / make tests RED (that is `component-test-scaffold`).
- Implement real module logic (that is `program-implementation`).
- Add real dependency logic — only what the placeholder needs to build and stay `/health`-green.

## What the template ships (copy wholesale, do NOT recreate)

The whole repo: `component-tests/` harness (runner, base steps, compose, `scripts/run-tests.sh`,
green smoke), `cmd/<svc>/main.go` placeholder (`501` except `/health`), `api-specification/`
skeleton, `go.mod`/`Dockerfile`/compose. See `component-test-scaffold` for the layout.

## Procedure (implementer, per the ticket)

1. **Confirm the ticket.** Template URL + rename params present; the frozen contract exists; else STOP.
2. **Clone wholesale.** Copy the template repo into the service repo. Do not touch runner internals.
3. **Rename.** Set the Go module path and service name; rename `cmd/<svc>/`.
4. **Configure.** Ports, env (`compose/envs/healthy.env`), service name in compose. Placeholder stays
   `501` everywhere except `/health` (200).
5. **Contract skeleton.** Put the frozen `api-specification/openapi.yaml` / `asyncapi.yaml` in place
   (the actual spec from stages 3–4, replacing the template's placeholder spec).
6. **Build & health.** `docker compose ... build` passes; bring it up; `/health` green;
   `smoke.feature` green (wiring intact).

**NO git.** Do **not** create/switch branches, commit, or open a PR. Leave the scaffold in the
**working tree**. Branching/commits/acceptance are decided one level up (module-development entry
point — TBD), not by the scaffold/implementer step.

## STOP

- No template exists for the service's stack → STOP, ask; never hand-assemble.
- The frozen contract (stages 3–4) is missing → STOP.
- Build fails or `/health` not green after clone+configure → STOP, fix; a broken skeleton must not
  reach stage 5/6.
- The ticket asks to add business logic here → STOP, that is `program-implementation`.

## Definition of Done

- Service repo scaffolded from the stack template; runner internals untouched.
- Module/service renamed; ports/env configured; placeholder `501`-except-`/health` intact.
- Frozen contract in `api-specification/`.
- `docker compose build` passes; `/health` green; `smoke.feature` green.
- Left in the **working tree** — no git branch/commit/PR (decided one level up, TBD).

## Foundations

Preconfigured stack templates (registry: [`docs/templates/README.md`](../../../docs/templates/README.md)),
`template-go-api` derived from the passkey-demo-api harness. Pairs with `component-test-scaffold`
(RED-ready). Git branching/commit is out of scope here (module-development entry point — TBD).
