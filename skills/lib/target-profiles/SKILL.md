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
| `toolchain` (version sources) | go.mod · Dockerfile golang base | go.mod · Dockerfile golang base |

`toolchain` lists the files that carry the toolchain version (`{label, file, extract, flags}` — `file`
matches the path, `extract` group 1 is the version). `validate-toolchain-consistency` demands ONE version
across all of them (a go.mod ↔ Dockerfile skew is a Gate #1 / DoD blocker). The version itself is DATA
(project files), never prose in a role or skill — the profile only says *where* to look, so another stack
= its own `toolchain[]`, zero validator/role edits.

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

## Shape vs provenance — two orthogonal axes (do NOT add a `foreign`/`library` shape)
A profile here is a **shape** (service / cli): *what* the harness builds, for a **harness-native** target it
owns end to end. A repo built **outside** the harness is a different axis — **provenance** — handled by the
**`route=foreign` lane** (`@wirth-triage` Axis 0.5), not by a shape profile. A foreign repo's paradigm (build,
test runner, fixture format, assert helpers) is **discovered per repo** by `@surveyor` into the repo-local
`docs/design/_harness/test-harness.md` — it does **not** belong in this global registry. So:
- Do **NOT** add a `foreign` (or stack-named `library`/`jvm`/`python`) profile here — provenance is not a shape;
  the per-repo map is the "profile" of a foreign repo. See `docs/features/route-foreign-lane.md`.
- A new **shape** (a genuinely new *harness-native* deliverable kind) still follows "Adding a shape" above.

## STOP
- an `if shape` / `if cli` appearing inside a stage role or validator → STOP, move it into the profile.
- a shape whose core (DTO/domain/logic/head) differs from other shapes → STOP: that is not a *shape*, it
  is a different requirement — the core must stay shape-agnostic.
- someone proposing a `foreign`/`library`/stack-named shape profile → STOP: that is **provenance**, use the
  `route=foreign` lane + the `@surveyor` per-repo map, not a global profile.
