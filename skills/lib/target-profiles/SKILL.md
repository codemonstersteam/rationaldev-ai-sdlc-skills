---
name: target-profiles
description: How the pipeline builds different deliverable SHAPES (HTTP service, CLI tool, …) without branching every stage on the shape. Each shape is a target profile — one cohesive vertical that owns its contract kind, ingress adapter, scaffold template, DoD checks and component-test flavour. Stages DELEGATE to the active profile; they never say "if cli". Adding a shape = one profile, zero stage edits. Data — harness/target-profiles.json. Use when a stage's behaviour depends on whether the deliverable is a service or a CLI. Keywords - target shape, profile, service, CLI, Strategy, open-closed, vertical slice.
version: "1.0"
---

# target-profiles — one vertical per deliverable shape

## What you are — the frame you reason from
The pipeline builds more than one **shape** of deliverable — an HTTP service, a CLI tool, later a
library. The naive way threads an `if shape == cli` through every stage (apidesigner, moduledesigner,
scaffold, DoD) — a **horizontal switch smeared across layers**, exactly the *layer-cake* this harness
forbids elsewhere. So the harness **eats its own dog food**: a shape is a **vertical slice**.

A **target profile** is that slice — one cohesive place owning everything a shape varies:

| field | service | cli |
|---|---|---|
| `contract` (the frozen boundary) | `openapi.yaml` | `config.schema.json` + `report.schema.json` |
| `ingress_skill` (the door) | `http-io` | `cli-io` |
| `template` (scaffold) | `template-go-api` | `template-go-cli` |
| `readme_sections` | failure-map · api · build-run | failure-map · usage · build-run |
| `ctest` (component-test flavour) | compose-service | one-shot-binary |

Two principles make this correct:
- **Strategy / Open-Closed (Meyer, SOLID).** Shape-variability lives in ONE object (the profile), so the
  pipeline is *open for extension* (add a profile) and *closed for modification* (stages untouched).
- **Tell, don't ask.** A stage does not *ask* "which shape?" and branch; it **delegates** — "freeze the
  profile's contract", "clone the profile's template". The stage stays shape-agnostic.

**The invariant everything else rests on:** the **core is shape-agnostic** — the same Request DTO, domain,
logic and head serve every shape. Only the *edges* differ (the door in, the contract artifact, the
template, the DoD). That is why adding a shape never touches the design or the core (see `cli-io`).

## The single source — `harness/target-profiles.json`
The profiles are **data**, not code, so validators (Node) and roles (prompts) read one truth. The
project's shape is declared once — `@gilb`/`@wirth-intake` write `.agent/planner/target` (one word:
`service`|`cli`); **no marker → `default` (`service`)**, so existing service runs are unchanged.

## How each stage delegates (never branches on shape)
```
gilb / intake      set  .agent/planner/target = <shape>          (measurable field in the BRD/FRD)
apidesigner        freeze  profile.contract                       (OpenAPI | config+report schema)
moduledesigner     ingress = profile.ingress_skill                (http-io | cli-io); Result → status|exit
scaffolder         clone   profile.template                       (via scaffold.sh)
validate-dod       run     profile.contract + profile.readme_sections + fixed infra
validate-contract-frozen   freeze  profile.contract
```

## Adding a shape (open-closed, by construction)
1. Add a profile to `harness/target-profiles.json` (contract · ingress_skill · template · readme_sections · ctest).
2. Add its row to the table above.
3. Provide the ingress skill (`*-io`) and the scaffold template if new.
That is all — **no stage manifest changes**. If you find yourself editing a role to say "if <shape>",
STOP: the variation belongs in the profile, not the stage.

## STOP
- an `if shape` / `if cli` appearing inside a stage role or validator → STOP, move it into the profile.
- a shape whose core (DTO/domain/logic/head) differs from other shapes → STOP: that is not a *shape*, it
  is a different requirement — the core must stay shape-agnostic.
