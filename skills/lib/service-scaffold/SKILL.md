---
name: service-scaffold
description: Start a service from a preconfigured stack template (copy — then work). Two faces — the PLANNER picks the template by stack/context and writes a scaffold ticket; the IMPLEMENTER clones and configures the template per that ticket, yielding a runnable placeholder service (builds, /health green, 501 elsewhere) BEFORE tests are authored. Use at stage 4b, after the contract is frozen and before component-tests. Do NOT hand-assemble a runner (that defeats the template) or make tests RED-ready (that is component-tests — realize half) or implement logic (program-implementation). Tier-agnostic: stack router, a clone-and-configure checklist, STOP.
version: "1.0"
status: "stable"
---

# service-scaffold — start a service from a stack template

Copy a preconfigured stack template, then configure it — **do not hand-build a runner**. Out: a
runnable **placeholder** repo (builds, `/health`=200, `501` on every other route) — the base later
stages fill in. Stage 4b: after the frozen contract (stages 3–4), before component-tests (stages 5–6).

> Companion (read on demand): [`planner.md`](./planner.md) — the **planner face** (stack router,
> which template, scaffold-ticket fields), what the template ships, foundations. The implementer
> below just runs the script and doesn't need it.

## Procedure (@scaffolder — via the script, NOT by hand)

All mechanics live in `harness/scaffold.sh <slug>` — don't repeat them by hand, trust the script:
1. `git archive` clones the template's contents into the project (no template `.git`; project `.git`/origin untouched).
2. Preserves the already-frozen `api-specification/` (no overwrite).
3. Renames the **go-module** (`template-go-api` → `<slug>`) across `.go`/`go.mod`. **`cmd/app` is NOT renamed** — stays as in the template (builds; Dockerfile/compose reference it — consistent).
4. `go build ./...` — build check.

Role @scaffolder: **run the script → on exit 0, check component health** (`docker compose build`,
`/health`=200, `smoke.feature`; placeholder `501` on other endpoints is normal) → green done / red fix.
Do **not** study the template, rename `cmd`, or edit Dockerfile/compose by hand.

**NO git.** Don't create/switch branches, commit, or open a PR — leave the scaffold in the **working
tree**. Branching/commits/acceptance are decided one level up (module-development entry point — TBD).

## STOP

- No template for the service's stack → STOP, ask; never hand-assemble.
- The frozen contract (stages 3–4) is missing → STOP.
- Build fails or `/health` not green after clone+configure → STOP, fix; a broken skeleton must not reach stage 5/6.
- The ticket asks to add business logic here → STOP, that is `program-implementation`.

## Definition of Done

Scaffolded from the stack template (runner internals untouched); module/service renamed, ports/env
configured, placeholder `501`-except-`/health` intact; frozen contract in `api-specification/`;
`docker compose build` passes, `/health` and `smoke.feature` green; left in the **working tree** (no git).
