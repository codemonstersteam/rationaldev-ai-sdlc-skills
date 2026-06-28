---
name: observability
description: SLI/SLO/guardrail at PLANNING and canary release-health at RELEASE — 4 golden signals (latency/traffic/errors/saturation), GREEN/YELLOW/RED verdict, rollback behind a feature toggle. Apply for planner (writes SLI/SLO/rollback plan into plan.md) and release-health/michtom (prod rollout + health analysis). No test environments — canary straight to prod. Do NOT apply for contracts (contract-tests) or black-box behavior (component-tests).
version: "2.0"
---

# observability — release observability and health

Bold CD: no test environments, only CI + canary. The agent verifies that a feature actually
**deployed and works** in prod, and decides whether to widen the canary or roll back based on
**signals**, not on "the deploy finished without error".

## No test environments — canary straight to prod

There are no test environments. Rollout goes **canary behind a feature toggle** straight to
prod on a **variable runtime** (VM / container / serverless — not necessarily Kubernetes). The
toggle starts on a small traffic share and widens only on green signals.

| | Canary in prod |
|---|---|
| Traffic | real, small share → grows |
| Toggle | OFF → opens in shares (1% → 5% → 25% → 100%) |
| Primary signal | 4 golden signals + SLO + guardrail vs baseline |
| Functional check | smoke/health on the canary share + manual check by the orchestrator (Human Gate #3) |

## Principle

"Deployed" ≠ "works". Green CI checks code before rollout; observability checks the system
**after** rollout, on real canary traffic. Rollout is gradual and **each step is confirmed by
signals**.

Base rule: **rollback is always cheaper than fixing in prod.** When in doubt, first return the
toggle/version to a safe state, then investigate.

## What goes into the plan (PLANNING stage)

Before implementation, `plan.md` MUST fix:

- **SLI** — indicators that the feature works (share of successful processings, p99 latency).
- **SLO and error budget** — target thresholds and the allowable error budget over the canary window.
- **Smoke/health checks** — concrete requests/scenarios proving the feature is live after rollout.
- **Guardrail** — a product metric that MUST NOT regress because of the feature.
- **Rollback plan** — how to instantly disable the feature (toggle OFF) and under what conditions to roll back the version.

## Four golden signals

After each canary step the agent compares the canary group with baseline (same service without
the feature / previous window):

1. **Latency** — separately for successful and failed responses.
2. **Traffic** — load/RPS: the feature gets expected traffic, no anomalies.
3. **Errors** — error share (5xx, exceptions, failed processings, rising retries/DLQ).
4. **Saturation** — resource saturation (CPU, memory, connection pools, queue lag).

Plus: **business guardrail** and **feature-specific SLI** from the plan.

## Canary rollout and health (role Release & Health / Michtom)

First the rollout mechanics, then an **independent** signal-based assessment (generator/critic
asymmetry inside the role):

- **Environment health-check** — service is up, liveness/readiness green, dependencies reachable.
- **Smoke on the canary share** — end-to-end run of the feature's key paths from the plan on real but small traffic.
- **Handoff to the orchestrator for a manual check** (Human Gate #3) — what autotests don't cover.
- Smoke/health failure = the feature is **not** widened; classify (implementation defect / deploy config) and return to the cycle or escalate.

### Verdict after a canary step

- **GREEN — widen.** All signals and SLI within SLO, guardrail not regressed, no degradation vs baseline over the window → widen the canary share.
- **YELLOW — hold.** Signals borderline / noisy / window too short → do not widen, extend observation. You MUST NOT widen on yellow.
- **RED — rollback.** SLO breached, error/latency spike, guardrail regression, abnormal saturation or burning error budget → **immediate rollback** (toggle OFF, version rollback if needed) + escalate to the orchestrator.

A verdict MUST always be justified with numbers (what was compared, over which window, against which threshold) and logged to the trace.

## What is forbidden (anti-gaming for CD)

- You MUST NOT **weaken SLO, alert thresholds, or change SLI definitions** to keep rolling out.
- You MUST NOT **silence/mute alerts** so a signal stops blocking progress.
- You MUST NOT **widen the canary share on YELLOW/RED** or with an insufficient window.
- You MUST NOT **burn the entire error budget** to push a feature through.
- You MUST NOT treat **absence of data** (empty dashboards, unconnected metrics) as "green". No signal = no progress.

Violation = automatic rollback and escalation.

## Output artifact

### In `plan.md`, section `## Наблюдаемость и проверка работоспособности`:

```markdown
## Наблюдаемость и проверка работоспособности

### SLI / SLO
| SLI | How measured | SLO | Window |
|-----|--------------|-----|--------|
| Notification deliverability | delivered / total events | ≥ 99.5% | 30 min canary |
| Processing latency | p99 from event to send | < 2s | 30 min |
| Processing error share | failed / total | < 0.5% | 30 min |

### Smoke / health (on the canary share in prod)
- HEALTH: service readiness green, dependencies (broker, gateway) reachable.
- SMOKE: test event for a synthetic id → exactly one expected effect within < 2s.

### Guardrail
- Key product metric does not drop because of the feature.

### Rollout and rollback plan
- Toggle shares: 1% → 5% → 25% → 100%, observation window 30 min per share.
- Rollback: feature toggle → OFF (instant). Version rollback — if degradation is outside the feature.
```

### POST-DEPLOY: report `.agent/release-health/release-health.md`:

```markdown
## Release health — <feature>

| Share | Window | Latency p99 | Errors | Guardrail | Verdict |
|-------|--------|-------------|--------|-----------|---------|
| 1%   | 30m | 1.4s (baseline 1.3s) | 0.1% | -0.0% | GREEN → 5% |
| 5%   | 30m | 1.5s | 0.2% | -0.1% | GREEN → 25% |
| 25%  | 30m | 1.6s | 0.3% | -0.1% | GREEN → 100% |
| 100% | 2h  | 1.6s | 0.3% | -0.1% | GREEN → stabilization |

Decision: feature rolled out to 100%, stable for 2h. Candidate for toggle removal — ticket CLEAN-77.
```

## Self-check checklist

- [ ] SLI/SLO and guardrail laid into the plan before implementation
- [ ] Smoke/health scenarios actually exercise the feature path (not "200 on /health")
- [ ] Each canary step compared to baseline over a sufficient window
- [ ] GREEN/YELLOW/RED decision justified with numbers and logged
- [ ] On RED — rollback done before investigation, escalation raised
- [ ] SLO/alert thresholds not weakened for the sake of rollout
- [ ] Absence of data not treated as "green"
- [ ] After 100% and stabilization a ticket to remove the toggle is filed
