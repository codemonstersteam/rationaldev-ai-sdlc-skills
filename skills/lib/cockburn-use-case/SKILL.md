---
name: cockburn-use-case
description: Promote a slice's brief use case (from requirements-intake) into a fully-dressed Cockburn system use case at docs/design/<slice>/use-case.md. Use at stage 2 of the planning pipeline, per slice, once the slice backlog exists — it is the definitive behavioral spec and the traceability source for component tests (each Extension → one failure mode → one error code). Do NOT use to elicit requirements from scratch (that is requirements-intake) or to design modules (program-design). Tier-agnostic: fixed fully-dressed template, a traceability rule, checklist, STOP rules.
version: "1.0"
status: "stable"
---

# cockburn-use-case.skill — fully-dressed system use case for a slice

## Purpose

**In:** one slice from `.agent/planner/slices.md` (stage 1) + its brief user-goal use case in the
FRD (`requirements-intake` Step 2) + the frozen contract. **Out:** a **fully-dressed** Cockburn
system use case at `docs/design/<slice>/use-case.md`.

`requirements-intake` writes use cases briefly, at user-goal level, across the whole service.
This skill **expands one slice's use case** to the fully-dressed level that downstream stages
need: it is the behavioral source of truth and drives the component tests (stage 5).

## Scope

DO:
- Expand exactly one slice's use case to fully-dressed form.
- Keep every Extension consistent with the failure-mode map and the contract. The cross-artifact
  traceability key is the **`error.code`** (stable across FRD ↔ use-case ↔ contract), **not** the
  Cockburn `a/b/c` label — the label is local step-numbering and MAY differ from the FRD's. Every
  Extension MUST carry its `error.code`.
- Sit the use case next to `c4.md` in `docs/design/<slice>/`.

DON'T:
- Elicit new requirements or invent actors/errors (that is `requirements-intake` — go back).
- Design module trees, contracts, or tests (later stages).
- Add file paths or code.

## Fully-dressed template → `docs/design/<slice>/use-case.md`

```md
# UC-<NN>: <goal as an active verb phrase>

- **Primary actor**: <who initiates>
- **Scope**: <this service / context>
- **Level**: user-goal            <!-- sea level; summary/subfunction only if justified -->
- **Stakeholders & interests**: <actor + each stakeholder and what they need from this UC>
- **Precondition**: <what must be true before>
- **Trigger**: <the external input — one endpoint / one consumed message>
- **Minimal guarantee**: <what holds even on failure>
- **Success guarantee (postcondition)**: <what holds on success>

## Main Success Scenario
1. <actor action>
2. <system response>
3. ...

## Extensions
- **2a. <condition>**: <system handling> → <outcome: error.code / status / event>
- **3a. <condition>**: <system handling> → <outcome>

## Technology & data variations (optional)
- <only if a step has a real variation worth recording>
```

## Rules (hard)

- **One trigger.** The use case has exactly one trigger = the slice's one external input
  (1 slice = 1 `Request`). More than one → the slice is too coarse, go back to `vertical-slices`.
- **A failure/framework/boot is NOT a use case — it is an Extension.** One external request = ONE
  use case; its error outcomes (4xx/5xx, store failure, bad input) are **Extensions** of it, never
  separate use cases. **Anti-examples (all WRONG as top-level UCs):** "Bad request / invalid sort"
  (input-validation → Extension), "Method not allowed (405)" / "Unknown route (404)" (HTTP framework,
  not a user goal), "Internal error (500)" (generic Extension), "Startup with invalid config" (boot
  precondition → Extension `0a`, not a use case). Rule of thumb: **`#use cases ≈ #endpoints/user-goals`,
  NOT `#outcomes`.** The deterministic gate `validate-frd.mjs` flags such pseudo-UCs.
- **Level = user-goal.** Write at sea level. Push implementation into no step; steps are
  actor↔system intentions, not code.
- **Glossary terms only.** Every noun uses the canonical `CONTEXT.md` term (no synonyms).
- **Extensions are exhaustive over the contract.** Every error the contract can return appears
  as an Extension; no Extension lacks a defined outcome.

## Traceability (the reason this artifact exists)

For the slice, these counts MUST match:

```
#Extensions  ==  #rows in the failure-mode map  ==  #error codes in the contract
```

- Each Extension that is **visible to the consumer** = one failure-mode-map row = one error code
  (this is the same 1:1 rule as `requirements-intake` Step 4 and `program-design` Step 8.6).
- The **wording** of each Extension is reused verbatim as the name of the matching component-test
  scenario (stage 5) — so use case ↔ test ↔ error code read the same. (Component-test *count* is
  governed by adapter branches, not by Extension count — see `component-tests`.)

## STOP

- Slice's brief use case absent from the FRD → STOP, run `requirements-intake` for it first.
- Use case would need 2+ triggers → STOP, re-slice in `vertical-slices`.
- An Extension has no outcome, or the contract has an error with no Extension → STOP, reconcile;
  do not invent — surface as an open question to the operator.

## Definition of Done

- `docs/design/<slice>/use-case.md` exists, one fully-dressed UC, all template fields filled.
- One trigger; user-goal level; glossary terms only.
- `#consumer-visible Extensions == #failure-mode rows == #error codes` for the slice.

## Foundations

Cockburn, *Writing Effective Use Cases* — fully-dressed format, goal levels, Main Success
Scenario + Extensions, stakeholders & interests, pre/postconditions. Example layout: the system
use case placed next to C4 in `pinout-openapi` (see [`docs/templates/README.md`](../../../docs/templates/README.md)).
