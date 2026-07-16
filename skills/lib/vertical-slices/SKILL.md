---
name: vertical-slices
description: Cut a service (or task) into atomic vertical slices — the spine of the planning pipeline. Use right after requirements-intake (FRD + high-level plan exist) and BEFORE specs/design: each slice is one end-to-end path through all layers, tied to exactly one external input, demoable on its own, dependency-ordered. Out — a slice backlog that each downstream stage (use case, OpenAPI/AsyncAPI, component tests, program-design) consumes one slice at a time. Do NOT use to design a slice's module tree (that is program-design) or to write code. Tier-agnostic, built for weaker tiers: rules, a granularity table, checklists, STOP rules.
version: "1.0"
status: "stable"
---

# vertical-slices.skill — cut a service into atomic vertical slices

## Purpose

**In:** the FRD from `requirements-intake` (problem statement, Cockburn use cases, interfaces,
draft contract + failure-mode map) and the high-level work plan. **Out:** a **slice backlog**
`.agent/planner/slices.md` — the ordered list of atomic vertical slices that the rest of the
pipeline ([`docs/04_PLANNING_PIPELINE.md`](../../../docs/04_PLANNING_PIPELINE.md)) processes one
slice at a time.

This is stage 1. It decides *what the slices are*, not *how a slice is built* — the module tree,
contracts and unit tests of a slice are `program-design` (stages 8–10).

## Scope

DO:
- Decompose the whole service/task into a list of slices.
- Tie each slice to exactly one external input (one entry point).
- Order slices by dependency; iterate granularity with the operator.

DON'T:
- Design module trees, contracts, or pseudocode (that is `program-design`).
- Write OpenAPI/AsyncAPI, use cases, tests, or code (later stages / their skills).
- Put detailed file lists or code snippets into a slice (those go stale). **But** the slice's
  **package root** `internal/<slug>/` is stable = the slice's identity — declare it (see `Owns package:`
  below). Designing the module *tree* inside that root is `program-design`, not the slicer.

## Vertical-slice rules (hard)

- **End-to-end, not a layer.** A slice cuts through ALL layers (input → logic → I/O → output),
  never a horizontal slice of one layer.
- **One external input = one slice = one `Request`.** A slice corresponds to exactly one entry
  point (one HTTP operation / one consumed message). A flag/option is a field of that input, not
  a new slice. (Same invariant program-design enforces at Step 3 — keep them aligned.)
- **NOT a slice (hard list).** These are outcomes/framework/boot/ticket-types of the SAME request —
  never their own slice: **error outcomes** (4xx/5xx), **method-not-allowed** (405), **unknown-route**
  (404), **config/startup/fail-fast** (boot), **internal-error** (500), and **scaffold** (that is a
  ticket *type*, not a slice). **Anti-example (WRONG):** `slice-service-scaffold`, `slice-method-not-allowed`,
  `slice-unknown-route`, `slice-config-fail-fast`. Rule: **`#slices ≤ #operations`** (one endpoint → at most one slice; the gate `validate-slices.mjs` enforces `≤`). One
  endpoint → exactly one slice; the rest are Extensions/framework/boot. The deterministic gate
  `validate-slices.mjs` (`#slices ≤ #operations` + pseudo-slice names) rejects over-decomposition —
  **prose "these are distinct inputs" does NOT override it.**
- **Demoable alone.** A finished slice is verifiable on its own (its component tests can go green
  independently).
- **No orphan value.** Every slice delivers a narrow but complete path a user/consumer can exercise.

## Steps

| Step | Does | Out |
|------|------|-----|
| 1 | Confirm input (FRD + high-level plan present; else STOP → `requirements-intake`) | verified input |
| 2 | List external inputs of the service (endpoints + consumed messages) | input list |
| 3 | Map each external input to one slice; name it + its **bounded context** in glossary terms | draft slices |
| 4 | Order slices by dependency (blockers first) | ordered list |
| 5 | Quiz the operator on granularity + dependencies; iterate to approval | approved backlog |
| 6 | Write `.agent/planner/slices.md` by the template below | slice backlog |

### Step 5 — operator quiz (present as a numbered list)

For each slice show: **Title**, **Blocked by**, **Use case(s) covered**. Ask:
- Granularity right? (too coarse / too fine)
- Dependencies correct?
- Merge or split any slice?

Iterate until the operator approves. **Do not proceed to stage 2 without approval.**

## Bounded context + CONTEXT-MAP (slice = context)

Each slice owns **one bounded context** — name it (glossary terms) in the slice's `Bounded context:` field.
Format for `CONTEXT-MAP.md` = the **single source** [`domain-modeling`](../domain-modeling/SKILL.md) — do
**NOT** re-describe it here.

- **Single context** (one slice, or all slices share one context): stays laconic — one root `CONTEXT.md`,
  **no** `CONTEXT-MAP`.
- **≥2 contexts:** finalize the root **`CONTEXT-MAP.md`** that intake seeded — **bind** each context to its
  slice `<slug>` and complete the **Relationships** section (upstream/downstream, shared types → `internal/shared/`).
  Intake **identified** the contexts; you **bind** them to slugs.
- **Ordering:** `docs/design/slice-<slug>/` does not exist yet (built by `program-design`). You finalize the
  **map**; the per-context `CONTEXT.md` co-locates into the design package when it is built (co-location B —
  knowledge in `docs/design/`, **never** `internal/`).

## Slice template (one per slice in `slices.md`)

```md
## Slice <NN>: <title in glossary terms>

Status: `todo`
External input: <one endpoint or one consumed message>
Owns package: `internal/<slug>/`   ← MANDATORY, always (incl. single-slice); the slice's
                                      code lives here. Layer-keyed roots (internal/httpapi,
                                      internal/io, …) are forbidden — `program-design` fills
                                      this root, `validate-layout` gates it.
Bounded context: <context name in glossary terms>   ← slice = one bounded context
Use case(s) covered: <ref to Cockburn use case section>

### What to build
End-to-end behavior of this slice (not layer-by-layer). What goes in, what comes out,
which failure modes are visible to the consumer.

### Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>

### Blocked by
<slice numbers, or "None — can start immediately">
```

## Granularity router

| Symptom | Verdict | Action |
|---------|---------|--------|
| Slice touches 2+ external inputs | too coarse | split — one input per slice |
| Slice is "add a field / a layer" with no end-to-end path | too fine / horizontal | merge into its end-to-end slice |
| Slice cannot be demoed without another unfinished slice | dependency, not a split | record under Blocked by |
| Two slices always change together | over-split | merge |

## STOP

- FRD or high-level plan missing → STOP, run `requirements-intake` first.
- A slice maps to more than one external input → STOP, split (breaks the 1-slice-1-Request invariant).
- Operator has not approved the backlog → STOP, do not hand off to stage 2.

## Definition of Done

- `.agent/planner/slices.md` exists, one section per slice, dependency-ordered.
- Every slice: exactly one external input, acceptance criteria, Blocked by, use-case reference.
- Operator approved the granularity and dependencies.
