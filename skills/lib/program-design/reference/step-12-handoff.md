<!-- program-design · step 12 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 12. Fill in the handoff checklist

**In:** the finished design package + backlog. **Out:** the `[x]`-filled handoff checklist in `backlog.md` + an open design PR.

#### Conformance-gate (STOP before handoff)

Mechanically run **all** the skill's hard rules first; any violation = **STOP**, return to the step, handoff forbidden.
→ *Why:* the implementer builds straight from the package — a rule broken here becomes wrong code, not a review comment.

- **Cross-cutting infrastructure has its own card + contract.** A cross-slice node (shared egress,
  shared `Request` flags, `infrastructure.md`) must have a design card, a contract, and pass every
  reconciliation. → *Why:* a shared node with no card runs no conformance checks — the direct root of defect D1.
- **Asymmetry.** `plan-reviewer` checks conformance against this skill as the reference standard — not Step 12's self-fill. → *Why:* the author of a plan is blind to its own gaps.
- **Anti-gaming.** You **MUST NOT** tick `[x]` without an existing artifact. → *Why:* a green checklist over a missing file is a silent lie the implementer trusts.

#### The approval marker (the implementer's start signal)

The checklist sits at the top of `.agent/planner/design/<slug>/backlog.md` under `## Handoff checklist`.
The planner fills **every** `[x]`, including the last line, in a strict format:

```
- [x] Operator approves the package — @<github-handle>, <YYYY-MM-DD>
```
(e.g. design PR created 2026-05-10: `- [x] Operator approves the package — @maxmorev, 2026-05-10`).

**Merging the design PR into `main` = the operator approving the package.** Agree → merge, the pre-filled
`[x]` stays in `main`; disagree → leave the PR open with comments, the planner reworks and bumps the date.
There is **no** separate "flip the tick after merge" ceremony.
→ *Why:* this line is the **only** deterministic sign the implementer reads for "package accepted" (`program-implementation` Step 0). `[ ]` or missing in `main` → the implementer does not start. While review drags, return it to `[ ]` so a casual reader isn't misled; on the final push before merge — `[x]` again.

#### Handoff checklist (grouped by concern — each group states its *why*)

Copy into `backlog.md`. All lines shown `[x]` = the norm for a merge-ready PR; an item left `[ ]` = an
explicit divergence, described in the slice card's `## Design decisions` so the operator sees it.

```
## Handoff checklist (planner fills fully; merging the PR = operator approval)

# Contract & failure map — the implementer builds against a FROZEN contract; a missing failure code = an unhandled error path
- [x] OpenAPI / AsyncAPI frozen; every slice endpoint described in it
- [x] contract has 5xx responses with `error.code` for every failure mode
- [x] README has the "Failure-mode map" table (status / event type, client action, operator action)
- [x] Gherkin component scenarios for all slice endpoints written, committed, stable (1 happy + 1 per distinguishable failure mode)

# Design package present — the implementer reads THESE, not the code
- [x] `.agent/planner/design/<slug>/` created and complete
- [x] intent.md — the task in one phrase
- [x] slices.md — slice table (input type, id, purpose)
- [x] messages.md — all data structures + `Result<T, Error>`
- [x] a per-slice module-tree file for every slice

# Module discipline — a violated node is leaky or untestable downstream
- [x] every slice has a head module (pipe orchestrator) with 5–10-step pipe pseudocode
- [x] slice layout by convention: head.go (`Process<Slice>`), adapter.go / logic.go / domain.go / errors.go / register.go; head exported directly, not behind a wrapper (Step 3)
- [x] every logic module has antecedent + consequent; every I/O module has a contract + failure modes
- [x] every module Input = one domain struct / DTO / void; deps on a separate `Dependencies:` line (Step 5); no node with 2+ data args
- [x] I/O isolated in an autonomous `Store`/`Client`/`Publisher`/`Consumer`/`FileStore` (Step 6); no raw `*sql.DB`/`*http.Client`/broker-conn in any `Dependencies:` or the head's `Deps`
- [x] single `Request` per slice; flags = `Request` fields; no side-injection past `Request`; no test-only I/O method; a branch on a field = a unit, not a component scenario (Step 3, lesson D1)

# Testing design — the wrong test level = false confidence or bloat
- [x] unit tests counted by formula for domain constructors + pure logic functions
- [x] the unit-test table of every slice card has NO head, NO I/O module, NO ingress adapter — all three are pipes, proven only by component scenarios (Step 8.1)

# Traceability — an unmapped requirement is a silent gap
- [x] every slice card has a `## Gherkin-mapping` table: each `Then` → a graph node or an adapter mapping (Step 8.4)
- [x] contracts-graph.md exists; every slice graph reconciled (all arrows `[x]`, incl. Gherkin coverage)
- [x] system Cockburn use case fixed; `#Extensions == #failure-scenarios == #error-codes` per slice (Step 8.6, both directions)
- [x] error model in messages.md: code dictionary + code→exit/HTTP mapping + "degradation is visible" rule (Step 4)

# Docs, C4 & cross-cutting — the reviewer/operator needs the map, and shared nodes must not fall between slices
- [x] c4.md present: C2 (container) + C3 (module tree) in Mermaid; C3 == the Step-3 tree; C1 on the landing (Step 3)
- [x] package docs authored by the `documentation` skill (procedures A/B/C), not free prose (doc-gate)
- [x] cross-cutting infrastructure (shared egress / flags / infrastructure.md) has its own card + contract, all reconciliations passed (Conformance-gate #1)
- [x] infrastructure.md — the app infrastructure module described

# Backlog & approval — the last line is the implementer's start signal
- [x] backlog.md — one ticket per slice, with dependencies
- [x] Operator approves the package — @<github-handle>, <YYYY-MM-DD>
```
