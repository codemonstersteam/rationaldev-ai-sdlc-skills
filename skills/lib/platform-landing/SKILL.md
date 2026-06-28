---
name: platform-landing
description: Deterministic procedure for a platform concept-repository (the coordination/solution-root of a polyrepo platform). Two parts. PART I — build and 5-pass refactor the concept README showcase landing plus its paired docs/get-started.md for the concept-level consumer (decide "is this platform for me" in 60 seconds, then take the first step). PART II — full lifecycle of a cross-service feature (touches >1 service): spec → plan → decomposition into per-service tasks linked to each service's backlog → status sync → close; via spec-driven development and polyrepo coordination (PRs in dependency order, "Depends on #X", shared branch names). Built for an orchestrator/planner tier: passes, hard limits, router tables, STOP rules, checklists. Apply IN the concept-repository. Do NOT apply for single-service documentation — that is the documentation skill; for quality review — doc-quality-review.
version: "1.0"
---

# platform-landing — platform concept-repository

The concept-repo plays two roles at once:
- **platform showcase** for the external consumer (PART I);
- **coordination-root** for cross-service features of a polyrepo platform (PART II).

This skill is a procedure, not a reference. Work step by step, don't improvise. Obey the
numeric limits literally. A STOP rule fired → stop and ask the operator.

> Single-service documentation (a service README, its `docs/architecture.md`) is the
> [`documentation`](../documentation/SKILL.md) skill. Quality review of finished docs is
> the [`doc-quality-review`](../doc-quality-review/SKILL.md) skill.

Pick the part:

| Task | Part |
| --- | --- |
| Build/refactor the concept landing (README + get-started) | **PART I** |
| Feature touches **>1 service** of the platform | **PART II** |
| Feature inside a single service | NOT here → `documentation` + per-repo flow |

---

# PART I — concept showcase landing

**Consumer:** concept-level consumer engineer and manager. **Job:** in 60 seconds decide
"is this platform for me", then take the first step.

**Documents:** the concept-repo `README.md` (showcase) + the paired `docs/get-started.md`
(stepwise onboarding).

## I.0 Hard limits (literal)

- Concept README — **one scroll**: ≤ 60 lines of body (excluding large ASCII blocks).
- Hero "what it is" sentence — **≤ 25 words**, one sentence.
- Any list item — **≤ 12 words**.
- Run commands for a specific service in the concept README — **0** (they live in the service repo).

## I.1 Anti-content: what MUST NOT be in the concept README

Walk the table. Found such content → move it per the "move to" column, don't leave it.

| If the concept README has… | …move to |
| --- | --- |
| API endpoints, pipe descriptions | service README |
| A specific service's architecture | service `docs/architecture.md` |
| Data model, project structure, run commands | service README |
| Implementation details at any level | service repo |
| Long quickstart, troubleshooting | concept `docs/get-started.md` |
| Manifesto / platform architecture / roadmap (expanded) | concept `docs/manifesto.md` / `docs/architecture.md` / `docs/roadmap.md` |

Rule: **the concept describes the SYSTEM, not a service.** The concept links, it does not copy.

## I.2 Five README refactor passes (in order)

**Pass L1 — Hero.** First line after the title: what the platform is, ≤ 25 words, one
sentence. Then — who it is for (1 line).
(Check: one sentence, ≤ 25 words.)

**Pass L2 — What it is made of.** The whole picture: a list of the platform's nodes/services/formats,
each one line ≤ 12 words. This is "which pieces the system is made of", without piece detail.
(Check: a list, not prose; no single-service detail.)

**Pass L3 — Anti-content cleanup.** Run section I.1 across the whole README. Each found
class — move it.
(Check: no row of table I.1 applies.)

**Pass L4 — Platform stack and diagram.** A `platform component → technology` table +
one top-level ASCII diagram (nodes/links), not a service's internals.
(Check: the diagram is about the platform, not one service.)

**Pass L5 — First step.** Links: to `docs/get-started.md` (stepwise onboarding) and to
specific example services. Link text is descriptive.
(Check: there is a link to get-started and at least one service.)

## I.3 Paired docs/get-started.md page

A separate file — stepwise onboarding to the platform (what does not fit the showcase):
prerequisites → onboarding steps (numbered, one action per step) → verification →
troubleshooting. Use the A6 pass limit from `documentation` (commands copy-paste and work).

## I.4 Ready templates

The [`templates/`](templates/) directory holds `.tmpl` files — fillable scaffolds for PART I:

| File | Purpose |
| --- | --- |
| `templates/landing-README.md.tmpl` | Skeleton of the concept-repo `README.md` with slots |
| `templates/get-started.md.tmpl` | Skeleton of `docs/get-started.md` with slots |
| `templates/component-row.md.tmpl` | One component-table row (inserted into `<<SLOT_COMPONENT_ROWS>>`) |

Usage: copy the `.tmpl` into the target file, fill the `<<SLOT_…>>` slots via passes
I.2–I.3. Unfilled slots → `<<HUMAN_NEEDED: reason>>`, do not delete.

## I.5 STOP (PART I)

- Asked to put a specific service's API/architecture/data into the concept README → STOP, move it per I.1.
- README is already human-written and the edit is large → STOP, confirm beforehand.

---

# PART II — cross-service feature

Apply when a feature touches **more than one service** of the platform. The concept-repo is
the coordination-root: design and the shared plan start here, then "flow into" the services'
local `backlog.md`.

The method is spec-driven development (spec → plan → tasks) over polyrepo coordination.

## II.0 Where the artifact lives

```
<concept-repo>/docs/features/<slug>/
  spec.md   — what and why (SDD spec)
  plan.md   — cross-service decomposition + links to service backlogs + statuses
```

`<slug>` — kebab-case feature name. One directory = one feature.

Templates (fill per the phases below):
- spec.md — [`docs/templates/feature-spec.md`](../../docs/templates/feature-spec.md)
- plan.md — [`docs/templates/feature-plan.md`](../../docs/templates/feature-plan.md)

## II.1 Phase 1 — Specify (spec.md)

Create `docs/features/<slug>/spec.md`. Fill exactly these blocks (SDD — 6 elements):

| Block | What to write |
| --- | --- |
| Problem / outcome | which task we solve, what counts as success |
| Affected services | list of platform repos that change |
| Scope | what is in and what is NOT in |
| Constraints | contracts/compatibility/non-functional constraints |
| Prior decisions | links to ADR/concept (what we stand on, what we don't reopen) |
| Acceptance criteria | how we'll know the feature is done (cross-service scenario) |

(Check: all 6 blocks filled; "affected services" ≥ 2 — otherwise this is not PART II.)

## II.2 Phase 2 — Design (high-level, in spec.md)

How the feature maps onto the platform: which **contracts between services** appear/change
(OpenAPI/AsyncAPI), who calls whom, the sequence.

- Any new contract between services is designed **spec-first** (skill `http-io` for outbound
  HTTP; the contract goes in the relevant service's `api-specification/`).
- STOP if a contract between services is undefined but the decomposition requires it.

## II.3 Phase 3 — Plan (plan.md, decomposition)

Create `docs/features/<slug>/plan.md`. The core is a per-service table with links:

```
| # | Service (repo)     | What it does for the feature  | Backlog task                            | Depends on | Status |
|---|--------------------|-------------------------------|-----------------------------------------|------------|--------|
| 1 | auth-service       | new endpoint X                | auth-service/backlog.md#<task>          | —          | todo   |
| 2 | gateway            | proxy X                       | gateway/backlog.md#<task>               | 1          | todo   |
| 3 | client-sdk         | wrapper method                | client-sdk/backlog.md#<task>            | 2          | todo   |
```

Rules (verify):
- Row order = **dependency order** (backend → shared → frontend).
- Each row links to a specific task in its service's `backlog.md`.
- The "Depends on" column — row numbers of predecessors (for PR order).

## II.4 Phase 4 — Linking (per-service)

For each plan.md row:
1. In the service repo create a task in its `backlog.md` with a **back-link** to the feature
   (`<concept-repo>/docs/features/<slug>/`).
2. Then the service follows its own flow: `program-design` → `program-implementation`.
3. Shared branch name across all repos: `feat/<slug>`.
4. PRs open in dependency order; the PR body has `Depends on <repo>#<PR>`.

(Check: every per-service task has a back-link to the feature.)

## II.5 Phase 5 — Status sync

`plan.md` is the **single source of truth for feature progress**.
- On each merge in a service → update the "Status" column of the matching row
  (`todo` / `in_progress` / `done`).
- Do not duplicate progress elsewhere — only plan.md.

(Check: status in plan.md matches the real state of the services' tasks.)

## II.6 Phase 6 — Close

The feature closes when:
- all plan.md rows are `done`, AND
- the cross-service scenario from "Acceptance criteria" (II.1) passes (cross-repo
  component/contract tests green).

Then: mark the feature `done` in `plan.md` (header), keep the directory as a history record.

## II.7 STOP (PART II)

- "Affected services" < 2 → this is not a cross-service feature, return to `documentation` + per-repo flow.
- A contract between services is required by the decomposition but not designed → STOP, ask.
- Asked to merge a service PR out of dependency order → STOP, warn about breaking the order.
- Only the operator merges PRs (the agent does not merge).

---

# Final checklist

PART I (landing):
- [ ] Concept README ≤ 60 lines, hero ≤ 25 words.
- [ ] No row of anti-table I.1 applies.
- [ ] Links to `docs/get-started.md` and at least one service exist.

PART II (feature):
- [ ] `spec.md`: all 6 blocks; affected services ≥ 2.
- [ ] New contracts between services — spec-first, in `api-specification/`.
- [ ] `plan.md`: rows in dependency order, each links to a service backlog.
- [ ] Every per-service task has a back-link to the feature.
- [ ] Statuses in `plan.md` are synced with reality; no other progress sources.
- [ ] Close only when all `done` + green cross-service acceptance criteria.
