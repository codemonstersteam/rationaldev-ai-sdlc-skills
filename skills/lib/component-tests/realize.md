# component-tests · realize — RED-ready implementation (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **на стадии реализации** (implementer/fixer в уже
> отскаффолженном скелете): когда роняешь designed `.feature`, разводишь compose-зависимости/стабы
> и доказываешь, что red — бизнес-причина. На стадии дизайна (счёт сценариев по формуле) НЕ нужен.

## WIP marker and slice acceptance

Component tests are authored RED before the slice is built (stage 6) and stay RED until the whole
slice is assembled — they are a black box over the **entire** service, so a half-built slice cannot
turn them green (test sequence: build → unit → component). To keep a half-built slice from looking
"done", tag the slice's component scenarios `@wip`:

```gherkin
@wip
Scenario: 3a токен истёк возвращает 401
```

- While `@wip` is present, the slice's suite is **not** a release gate and does not block the slice's
  per-ticket PRs.
- On **slice completion** the **fixer** runs the slice's component tests; when they are **GREEN** the
  fixer **removes `@wip`** and accepts the slice's work. Removing `@wip` **is** the acceptance act.
- **Only the fixer removes `@wip`.** An implementer MUST NOT (anti-gaming — see
  `program-implementation`, and orchestration in [`docs/04_PLANNING_PIPELINE.md`](../../../docs/04_PLANNING_PIPELINE.md) §6).

## Realize the designed scenarios — RED-ready against the skeleton (implementation)

The formula/Cockburn-1:1/`@wip` half in `SKILL.md` is **design** (a GLM planning role). The **implementation**
half — done by the component-test implementer in the **already-scaffolded** skeleton (`service-scaffold`
cloned the template: placeholder-`501` service + godog/Docker-Compose runner, `/health` green) — makes
the designed scenarios **execute and be all RED by a business reason**. You do **not** clone or author
scenarios here: drop the designed `.feature` in, wire this slice's deps/stubs, prove the red is business.

Procedure:
1. **Drop in scenarios.** Put the slice's designed `.feature` into `component-tests/features/`; tag `@wip`.
2. **Wire deps & stubs.** Each external dependency → its **compose service** (e.g. a DB image); each
   external API → a **stub speaking the real protocol** (never an in-code mock), reached by service name.
   Add services to the parametrized compose — don't rewire the runner.
3. **Missing step-definition → ADD it** (mechanical glue: subprocess/exit-code, HTTP call, log match).
   Reuse an existing phrasing when one fits; add a new step-def only to make a **designed** scenario
   executable. Do **not** invent a new *scenario* inline — a new scenario is a design act (STOP, back to design).
4. **Failure profiles.** Hard-to-reproduce adapter branch → overlay `docker-compose.<profile>.yml` +
   `compose/envs/<profile>.env`, mirroring the template pattern.
5. **Run** `./scripts/run-tests.sh healthy` (+ each failure profile). Every slice scenario RED.

### RED-reason decision table (the crux)

A scenario is **RED-ready** only when it fails for a *business* reason:

| Symptom | Red reason | RED-ready? | Action |
|---------|-----------|:---------:|--------|
| Assertion fails: got `501`, expected real status | business — placeholder not implemented | ✅ yes | leave red; implementation fixes it |
| `docker compose build` fails (compile) | setup | ❌ no | fix build (or back to `service-scaffold`) |
| Runner can't reach SUT / dep (dns, port, healthcheck) | wiring | ❌ no | fix compose deps/stubs networking |
| Step undefined / regex mismatch / panic | harness | ❌ no | reuse or **add** the step-def → then it's a business red |
| `/health` not green → `up` aborts | skeleton broken | ❌ no | back to `service-scaffold` |
| Scenario green | too early — nothing implemented | ❌ no | scenario is wrong — recheck |

Only the **first row** is acceptable RED; every other red is a bug to fix, not the RED phase. `go test`
from the host is **forbidden** — the runner runs **only** in Docker (same env in CI and locally).
