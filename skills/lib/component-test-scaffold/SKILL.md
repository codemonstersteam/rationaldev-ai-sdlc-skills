---
name: component-test-scaffold
description: Make a slice's authored .feature scenarios EXECUTE and be all RED by business reason against the already-scaffolded service skeleton (service-scaffold, stage 4b, gave you the placeholder-501 service + godog/Docker-Compose runner). Drop in the scenarios, wire the slice's deps/stubs, run — every scenario RED because the placeholder returns 501, never red from setup/compile/wiring. Use at stage 6, after component-tests (stage 5) authored the scenarios. Do NOT clone/scaffold the skeleton (that is service-scaffold), author scenarios/formula (component-tests), or implement logic (program-implementation). Tier-agnostic: red-reason decision table, exact commands, STOP.
version: "0.1"
status: "draft"
---

# component-test-scaffold.skill — make the authored tests RED-ready

## Purpose

**In:** the scaffolded service skeleton (`service-scaffold`, stage 4b — placeholder-501 service +
runner already build and `/health` is green) + the slice's authored `.feature` scenarios
(`component-tests`, stage 5) + the frozen `api-specification/`. **Out:** the scenarios execute and are
**all RED by business reason** — the placeholder answers `501` everywhere except `/health`. This is
the RED end of TDD; `program-implementation` turns them green one module at a time.

You do **not** clone or assemble anything — the skeleton exists. You **drop in scenarios, wire this
slice's deps/stubs, and prove the red is a business red.**

## Scope

DO:
- Add the slice's `.feature` into the existing `component-tests/features/`.
- Wire this slice's real deps/stubs into the already-parametrized compose.
- Run and prove every scenario is RED for a business reason.

DON'T:
- Clone/rename the skeleton (that is `service-scaffold`, stage 4b).
- Author scenarios / fixtures / the formula (that is `component-tests`).
- Implement real module logic (that is `program-implementation`).
- Run `go test` from the host — the runner runs **only** in Docker.

## Precondition (from stage 4b)

The skeleton is present and healthy: `docker compose build` passes, `/health` green,
`smoke.feature` green, placeholder returns `501` on real routes. If not → STOP, back to
`service-scaffold`.

## Procedure

1. **Confirm inputs.** Skeleton healthy (above); `.feature` scenarios exist (stage 5); contract frozen.
2. **Drop in scenarios.** Put the slice's `.feature` files into `component-tests/features/`. Reuse
   existing step phrasings; a missing phrasing → STOP and add it in the template step stage, don't
   invent inline.
3. **Wire deps & stubs.** For each external dependency add its compose service; for each external API
   add a **stub speaking the real protocol** (never an in-code mock), reached by service name. Add
   services to the parametrized compose — do not rewire the runner.
4. **Failure profiles.** For each hard-to-reproduce adapter branch add an overlay
   (`docker-compose.<profile>.yml` + `compose/envs/<profile>.env`), mirroring the template pattern.
5. **Run.** `./scripts/run-tests.sh healthy` (+ each failure profile). All slice scenarios RED.
6. **Assert RED-ready** via the table below; fix any red whose cause is setup/wiring, not business.

## RED-reason decision table (the crux)

A scenario is **RED-ready** only when it fails for a *business* reason:

| Symptom | Red reason | RED-ready? | Action |
|---------|-----------|:---------:|--------|
| Assertion fails: got `501`, expected real status | business — placeholder not implemented | ✅ yes | leave red; implementation fixes it |
| `docker compose build` fails (compile) | setup | ❌ no | fix build (or back to service-scaffold) |
| Runner can't reach SUT / dep (dns, port, healthcheck) | wiring | ❌ no | fix compose deps/stubs networking |
| Step undefined / regex mismatch / panic | harness | ❌ no | reuse the right step / fix it |
| `/health` not green → `up` aborts | skeleton broken | ❌ no | back to service-scaffold |
| Scenario green | too early — nothing implemented | ❌ no | scenario is wrong — recheck |

Only the **first row** is acceptable. Every other red is a bug, not the RED phase.

## Commands

```bash
./scripts/run-tests.sh              # healthy profile (default)
./scripts/run-tests.sh <profile>    # e.g. disk-full — one per hard-to-reproduce branch
```

`go test ./steps/...` from the host is **forbidden** (isolation: same env in CI and locally,
internal Docker network, reproducible failures).

## STOP

- Skeleton not healthy (build/`/health`/smoke) → STOP, back to `service-scaffold`.
- `.feature` scenarios or frozen contract missing → STOP (stages 5 / 3 first).
- A scenario is green at this stage → STOP, the scenario is wrong (nothing is implemented yet).
- A red is caused by build/wiring/step (not row 1) and can't be fixed here → STOP, report; never
  weaken the scenario to hide it (anti-gaming).
- A needed step phrasing is missing → STOP, add it in the template step stage, don't invent inline.

## Definition of Done

- Slice scenarios in `component-tests/features/`; slice deps/stubs wired.
- `./scripts/run-tests.sh` runs for healthy + each failure profile.
- **Every slice scenario is RED and every red is row-1 (business reason).**
- No host-side `go test`.

## Foundations

Runs on the `service-scaffold` skeleton (`template-go-api`, godog + Docker Compose, placeholder-501).
Articles: "Сколько компонентных тестов нужно сервису" / "Компонентные тесты на практике"
(codemonsters.team, 2026-04). Pairs with `component-tests` (authoring), `service-scaffold` (skeleton),
`program-implementation` (RED→GREEN).
