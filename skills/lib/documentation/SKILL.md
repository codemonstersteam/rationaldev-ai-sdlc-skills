---
name: documentation
description: Deterministic procedure for creating and maintaining a service repository's documentation as a product, for four JTBD consumers (author-engineer, consumer-engineer, concept-level consumer, AI agent). Written for reliability on weaker models — stepwise passes, router tables instead of judgement, hard numeric limits, STOP rules, fill-in templates, final checklist. Apply when assembling or updating README or docs/architecture.md, deciding which file a piece of content belongs in, or updating docs on a change trigger. Do NOT apply for reviewing already-written docs (use doc-quality-review) or for the concept platform landing (use platform-landing).
version: "1.0"
---

# Documentation — deterministic procedure

A repository's documentation is a product for four audiences, not a dump of prose.
This skill is a **procedure, not a reference**. Follow the steps; do not improvise.

> **Concept level (platform landing)** is designed by a separate skill,
> [`platform-landing`](../platform-landing/SKILL.md). Here we only point from the
> service repo to concept (below) and route "what does NOT go into concept".

---

## 0. How to use this skill

1. Follow the chosen procedure (A, B or C) exactly, step by step. Do not skip passes.
2. One pass = one narrow task. Finish a pass, check its condition, then the next.
3. Obey numeric limits literally (count the words).
4. A STOP rule (section 2) fired → stop and ask the operator. Do not guess.
5. At the end, run the final checklist (section 7). Every item must be "yes".

Procedure selection:

| Task | Procedure |
| --- | --- |
| Assemble or rebuild `README.md` | **A** (section 3) |
| Assemble or rebuild `docs/architecture.md` | **B** (section 4) |
| Update docs after a code/contract change | **C** (section 5) |
| Don't know which file a text goes in | **Router** (section 1) |
| Assess quality of ALREADY-written docs | skill [`doc-quality-review`](../doc-quality-review/SKILL.md) |

---

## 1. Router: which content goes in which file

Take a piece of content. Find its row. Put it exactly there. Nowhere else.

| Content class | Destination file |
| --- | --- |
| What the service does, why, boundaries (can / can't do) | `README.md` |
| API table (method, resource, action) | `README.md` |
| Pipe description of an API (data flow by steps) | `README.md` |
| Failure table (error code → exit / HTTP status) | `README.md` |
| Stack (component → technology) | `README.md` |
| Run and check commands | `README.md` |
| Machine API contract (schemas, endpoints) | `api-specification/` (OpenAPI/AsyncAPI) |
| Module tree (who calls whom) + head-module pseudocode | `docs/design/<slice>/module-tree.md` (authored by `program-design`); `architecture.md` links it |
| C4 **C1/C2** (context / container) | `docs/architecture.md` (C1 — on the platform landing, concept repo) |
| C4 **C3** (component = slice module tree) | `docs/design/<slice>/c4.md` (authored by `c4`) |
| Cockburn system use case (per slice) | `docs/design/<slice>/use-case.md` (authored by `cockburn-use-case`) |
| Why a technology/pattern/structure was chosen | `docs/adr/` (+ a line in `CLAUDE.md`) |
| Contribution rules | `CONTRIBUTING.md` |
| Task queue, statuses | `backlog.md` |
| Module state, decisions, next session step | `CLAUDE.md` |
| Step log (prompts, result) | `devlog/NN-topic.md` |
| Description of the WHOLE PLATFORM (not one service) | NOT here → platform concept repo |

**Platform link (optional):** If the service is part of a platform, the first lines of the service README may carry:
```
> Part of platform [<Platform name>](<link to concept repo>). Architecture and concept live there.
```
If there is no platform or no link is needed — do not add it.

**Do NOT put in the concept README** (if it leaked in, return it via the row above):
API endpoints, pipe descriptions, service architecture, data model, run commands,
project structure, implementation details, long quickstart, troubleshooting.

---

## 2. STOP rules

You MUST stop and ask the operator — do NOT continue — if:

- You can't tell which segment (section 6) the document serves.
- The router (section 1) has no matching row for a piece of content.
- You must delete or rewrite an existing section written by a human, not an agent.
- The API contract (`api-specification/`) is missing but the README needs an API table.
- You are asked to put a whole-platform description into a service README (that belongs in concept).
- A limit forces dropping a substantive fact — ask where to move it, do not drop it silently.
- **Documentation is being created outside procedures A/B/C** ("off-skill"): free prose that bypasses the router and passes — STOP. All content is first routed (section 1) and written by a pass of the matching procedure. This is a **gate**: the `program-design` output artifact passes through this skill, it is not written separately.

---

## 3. Procedure A — README.md

The README serves TWO segments at once: author and consumer (section 6).
Run the passes in order. After each, check the condition in parentheses.

**Pass A1 — Title and one sentence.**
Write: name + what it is, **one sentence ≤ 20 words**. Then the pointer line to concept (section 1).
(Check: exactly one sentence, not a paragraph.)

**Pass A2 — Boundaries.**
A "Can / Cannot" block — two lists. Each item ≤ 12 words.
(Check: both lists present, "can" and "cannot".)

**Pass A3 — Stack.**
Table `component → technology`. Only what is actually used.
(Check: table, not prose.)

**Pass A4 — API table.**
Table `method | resource | action`. Source of truth — `api-specification/`.
No contract → STOP (section 2).
(Check: each row matches an endpoint from the spec.)

**Pass A5 — Pipe description of each API.**
For each endpoint — data flow by steps via `|`. Template:
```
POST /v1/registrations
| Accept handle from client
| Generate challenge (32 bytes, TTL 5 min)
| Store challenge in DB
| Return challenge + WebAuthn options → 201
```
Pipe = "how it works and where it can break". The A4 table = "what exists". Both are needed.
(Check: number of pipe blocks = number of rows in the API table.)

**Pass A5b — Failure table and error model.**
Table `return code → meaning → error codes`. For CLI — `exit` (0 success / N…); for HTTP — statuses. Source — the error dictionary from the contract/design (`error.code`), not from the code.
```
| Exit | Meaning | Error codes |
|------|---------|-------------|
| 0    | success | —           |
| 2    | config error | CONFIG_NOT_FOUND, CONFIG_INVALID |
```
Below the table — one line on the error shape (`code`/`message`/`location`/`context`) and the rule: anything unchecked / degraded is **visible** in the output, never masked as success.
(Check: every `error.code` from the contract is in the table; the happy path and every failure mode have a row.)

**Pass A6 — Run.**
Minimal steps: run commands + a link to `component-tests/`.
(Check: commands can be copied and executed.)

**Pass A7 — Links inward (ladder).**
Do not copy into the README — place links in the order context is built up:
```
README.md (what it is, how to run)
  → component-tests/ (how it works from outside)
    → docs/design/<slice>/ (use case, C4 C3, module tree — how each slice is designed)
      → docs/architecture.md (service-level C2 container + links)
        → docs/adr/ (why it was done this way)
          → CONTRIBUTING.md (how to change it correctly)
```
(Check: design, architecture and ADR are links, not body text in the README.)

---

## 4. Procedure B — docs/architecture.md

Serves the author, the consumer-extending-it, and the AI agent (section 6).

> **Ownership (pipeline reconciliation).** The **per-slice** design artifacts — module tree,
> head-module flowchart/pseudocode, C4 **C3**, and the Cockburn system use case — are **authored per
> slice by the dedicated skills** (`program-design`, `c4`, `cockburn-use-case`) into
> `docs/design/<slice>/` (see [`docs/05_REPO_STRUCTURE.md`](../../../docs/05_REPO_STRUCTURE.md)).
> Here `docs/architecture.md` holds only the **service-level C2 container** view and **links** each
> slice's design — do NOT re-author it. The B-passes below are the authoring templates those skills
> reuse; on any conflict, the dedicated skill and `docs/design/<slice>/` win.

**Pass B1 — Module hierarchy diagram.**
Tree from the top module down. Template:
```
main
├── server (HTTP server, routing)
│   ├── handlers/registration (registration handling)
│   │   ├── challenge (challenge generation)
│   │   └── attestation (attestation verification)
│   └── middleware/auth (JWT verification)
├── store (DB access)
│   ├── users
│   └── challenges
└── tokens (JWT generation and validation)
```
Rules (check every node):
- One node = one module = one responsibility.
- Arrows go top-down only — a lower module does NOT know about an upper one.
- I/O modules (store, HTTP) are separated from business logic.
- An I/O object is self-contained: the head module knows only its methods, not its dependencies.
  Name by integration type: `Store` (DB), `Client` (HTTP), `Publisher`/`Consumer` (broker).
  A slice's `Deps` holds the object, not raw material (`*sql.DB`, `*http.Client`).

**Pass B2 — Head module flowchart.**
The entry point's control flow. Template:
```
main()
  │
  ├─ Load configuration from ENV
  │  └─ Missing required variable? → panic with explicit message
  │
  ├─ Open DB, run migrations
  │  └─ Error? → panic
  │
  ├─ Build router
  │  ├─ /v1/registrations → registration handlers
  │  └─ /v1/sessions → session handlers
  │
  └─ Start HTTP server
     └─ Graceful shutdown on SIGTERM
```
Rules (check):
- Control flow only, no implementation details.
- Every error branch is shown explicitly (what happens on failure).

**Pass B3 — C4 in Mermaid, by level (mandatory).**
Draw C4 in ` ```mermaid ` blocks (`C4Context`/`C4Container`/`C4Component`) — renders on GitHub without plugins. Level → where it lives:

| Level | What it shows | Where |
| --- | --- | --- |
| **C1** System Context | system ↔ actors ↔ external systems | platform landing (concept repo, skill `platform-landing`) |
| **C2** Container | deployable units + libraries used | this file (`architecture.md`) |
| **C3** Component | the slice's module tree (= the Pass B1 diagram) | this file (`architecture.md`) |

(Check: C2 and C3 present in the component repo; C3 matches the Pass B1 module tree; a link to the landing's C1 is present.)

**Pass B4 — Cockburn system use case (C4 level "how the program works").**
Describe a **system use case (fully dressed, Cockburn)** — this is the C4 level of the model. Template (fill by fields, not prose):
```
UC-N · <goal in one phrase>
Scope / Level / Primary Actor / Trigger
Stakeholders & Interests · Preconditions
Minimal Guarantee · Success Guarantee
Main Success Scenario: 1…k (numbered steps)
Extensions: each NNa = one failure mode (error code + exit/outcome)
```
The link is hard: **1 slice = 1 external input = 1 use case**, and **each Extension `NNa` corresponds to one component Gherkin scenario** (see `program-design` Step 8 and `component-tests` "Formula").
(Check: every failure mode from the failure table (Pass A5b) appears as an Extension; number of Extensions = number of failure scenarios in the `.feature`.)

---

## 5. Procedure C — update docs on a trigger

An event happened → find the row → update exactly the listed files.

| Event | What to update |
| --- | --- |
| New endpoint / contract change | `api-specification/`, `README.md` (API table + pipe) |
| Entry point change or new domain | `docs/architecture.md` (flowchart, proc. B) |
| New / changed slice or external input | `docs/architecture.md` (C3 tree, C4 use case + extensions, proc. B3/B4), `README.md` (failure table) |
| Significant architectural choice | context-local → `docs/design/slice-<slug>/adr/`; system-wide → root `docs/adr/` (+ line in `CLAUDE.md`) |
| Step merge | `CLAUDE.md` (Module status, Next step), `backlog.md` (Done) |
| Repo structure / run method change | `README.md` (Structure, Run) |
| Development step completed | `devlog/NN-topic.md` |

Format templates:
- Devlog entry: [`docs/templates/devlog.md`](../../docs/templates/devlog.md) — after each step's merge.
- ADR: format + numbering + three-condition «offer sparingly» → [`domain-modeling`](../domain-modeling/SKILL.md) → `ADR-FORMAT` (single source). Placement: context-local → `docs/design/slice-<slug>/adr/`, system-wide → `docs/adr/`.

---

## 6. Reference: four segments (JTBD)

Use this to figure out "who am I writing for" in the passes. Do not edit a document until
you have identified the segment (otherwise STOP, section 2).

| Segment | Job (why they read) | Main documents |
| --- | --- | --- |
| 1. Author-engineer (maintainer) | Drive onboarding cost to zero | `README.md` (top) + `CONTRIBUTING.md` + `docs/adr/` + `docs/architecture.md` |
| 2. Consumer-engineer (other team) | Decide in 5 min whether it solves their problem; shortest path to result | `README.md` |
| 3. Concept-level consumer | Decide in 60 sec "is this platform a fit", then the first step | concept repo (skill `platform-landing`) |
| 4. AI agent | Load context in minimum tokens and be ready for the task | `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md` |

Writing principles for segment 4 (AI agent): maximum facts per token, zero filler;
one flat file (the agent reads linearly, does not click); structure via tables and
headings, not prose; explicit prohibitions — "do NOT do X", not "try to avoid X".

---

## 7. Final checklist

Check before finishing. Every item must be "yes". Any "no" → go back and fix.

- [ ] Every piece of content lives in a file from the router (section 1); no duplicates.
- [ ] The README's first line is the pointer to concept.
- [ ] README: one-sentence "what it is" (≤ 20 words), not a paragraph.
- [ ] README: has both "can" AND "cannot".
- [ ] README: number of pipe blocks = number of rows in the API table.
- [ ] README: has a failure table (Pass A5b); every `error.code` from the contract is in it.
- [ ] README: architecture and ADR are links, not body text.
- [ ] `architecture.md`: has both the module tree AND the entry-point flowchart.
- [ ] `architecture.md`: arrows top-down only; I/O separated from logic.
- [ ] `architecture.md`: C4 drawn (C2 + C3 in Mermaid, C3 = module tree); link to the landing's C1 present.
- [ ] `architecture.md`: Cockburn system use case (Pass B4) present; number of Extensions = number of failure scenarios in the `.feature`.
- [ ] All content created by passes A/B/C, not free prose bypassing the skill (gate, section 2). No `[x]` without a real artifact.
- [ ] On a trigger (section 5), ALL listed files updated, not just some.
- [ ] No STOP rule (section 2) was violated silently.
