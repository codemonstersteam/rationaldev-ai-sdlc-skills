---
name: requirements-intake
description: Turn a (possibly incomplete) business requirement into a functional-requirements document the planner can design from — actors, interfaces, Cockburn system use cases, a domain glossary, and the API contract + failure-mode map. Use as the FIRST step on a new task or an empty project, before program-design. Do NOT use to design module trees or write code (that is program-design / program-implementation). Tier-agnostic: active elicitation, router tables, checklists, STOP rules.
version: "1.0"
---

# requirements-intake — from business requirement to functional requirements

The planner's front door. **In:** a **business requirement (BRD)** — the "why/what" from
the operator, often incomplete. **Out:** a **functional-requirements document (FRD)** at
`requirements/<slug>.md` plus a domain glossary and a draft API contract + failure-mode map
— exactly the artifacts `program-design` Step 0 requires.

You **MUST NOT** design module trees or write code here; that is `program-design` /
`program-implementation`. Requirements first, design second (stepwise refinement — a
program is refined from a precise specification, never from one phrase).

## Where do I start? (empty project / "what now?")

When loaded into an empty project and asked where to start, **answer with this**:

> Describe the **business requirement**: what the program must do, which **APIs** it exposes
> and consumes, and which systems it talks to over which **interfaces** (HTTP / gRPC /
> broker / CLI). I'll turn it into **functional requirements (Cockburn use cases)** and
> freeze the **API contract** — design does not start without them.

## What "ready to design" means

A BRD is design-ready only when intake has produced all of:
1. **Problem statement** — one phrase (the old "intent"), the FRD's first line.
2. **Actors & external systems + interfaces** — who/what uses it and what it calls, over
   which protocol (ports & adapters).
3. **Functional requirements as system use cases (Cockburn)** — one per external input.
4. **Domain glossary** (ubiquitous language) — fuzzy terms pinned.
5. **APIs exposed/consumed → a draft contract** (OpenAPI/AsyncAPI) + the **failure-mode map**.
6. **NFR / constraints** and an explicit **open-questions** list.

If any is missing and can't be elicited, you **MUST stop** and ask — don't invent it.

## Procedure

### Step 0 — read the BRD
**In:** the business requirement. **Out:** decision to proceed or stop.
You **MUST stop** if there is no BRD at all, or it's a bare title with no goal — ask the
operator for the one-phrase goal and the primary actor first.

### Step 1 — actors, external systems, interfaces
List every actor (human/system) and every external system the program calls. For each
boundary name the **interface**: HTTP endpoint, gRPC method, broker topic/queue, CLI
subcommand, file. This is the program's **ports** (Cockburn hexagonal). An interface you
can't name is an open question, not a guess.

### Step 2 — functional requirements as use cases (Cockburn)
**One external input = one system use case.** For each, write at the **user-goal level**:
- **Primary actor** and **stakeholders**;
- **Preconditions** and **success guarantee** (postcondition);
- **Main Success Scenario** (numbered steps);
- **Extensions** `NNa` — each failure/alternate branch, with its outcome.

This is the rational requirements vehicle: the Main Success Scenario becomes the happy path,
each **Extension** becomes a failure scenario downstream (`component-tests`, `program-design`
Step 8.6). The use case is the FRD's core.

### Step 3 — sharpen the domain (active, domain-modeling style)
While eliciting, **actively** de-fuzz the language (don't passively accept the BRD's words):
- **Challenge** a term that conflicts with itself or the code ("you said 'account' — Customer or User?");
- **Stress-test** with concrete edge-case scenarios that force precise boundaries;
- **Pin** each resolved term in a glossary (ubiquitous language) at `CONTEXT.md`, inline, the moment it crystallises.
Record genuinely hard-to-reverse, non-obvious trade-offs as ADRs in `docs/adr/` — sparingly.

### Step 4 — derive the contract and failure-mode map
From the use cases + interfaces, draft:
- the **API contract** — `OpenAPI` for sync endpoints, `AsyncAPI` for events (both for a mixed service);
- the README **`## Карта режимов отказа`** — one row per distinguishable failure mode
  (`error.code`, HTTP status / event type, headers, client action, operator action), taken
  1:1 from the use-case Extensions.
These are not external preconditions — intake **produces** them. They then satisfy
`program-design` Step 0.

### Step 5 — NFR, constraints, open questions
Record non-functional requirements (load, latency/SLO, security, data classification) and an
explicit **Open questions** section for every gap the BRD didn't answer. An open question is
a first-class output, not a blocker to hide.

## STOP rules

You **MUST stop** and ask the operator, never guess, when:
- there is no BRD or no stated goal/primary actor;
- an external interface or protocol can't be determined from the BRD;
- a use case has no clear success guarantee or its Extensions are unknowable;
- the request is to start designing or coding before the FRD exists → run intake first.

You **MUST NOT** fabricate actors, interfaces, error codes, or NFR to make the FRD "look
complete" — surface the gap as an open question.

## Output → `requirements/<slug>.md` (the FRD)

```
# <slug> — FRD
## Problem statement        # one phrase
## Actors & external systems # + interface per boundary (HTTP/gRPC/broker/CLI)
## Use cases                 # Cockburn: actor, pre/postcondition, MSS, Extensions
## Glossary                  # ubiquitous language (or link to CONTEXT.md)
## Contract (draft)          # OpenAPI/AsyncAPI skeleton from the use cases
## Failure-mode map          # → README ## Карта режимов отказа
## NFR / constraints
## Open questions
```

## Handoff checklist (before program-design)

- [ ] problem statement (one phrase) recorded;
- [ ] every external input has an actor, an interface, and a use case;
- [ ] each use case has Main Success Scenario + Extensions with outcomes;
- [ ] fuzzy terms pinned in the glossary;
- [ ] draft contract (OpenAPI/AsyncAPI) and `## Карта режимов отказа` derived from the use cases;
- [ ] NFR and open questions listed;
- [ ] no fabricated facts — gaps are open questions.

When this is green, the FRD + contract + failure-map satisfy `program-design` Step 0.

## Foundations

Cockburn, *Writing Effective Use Cases* (goal levels, Main Success Scenario + Extensions,
actors/stakeholders, pre/postconditions) and *Ports & Adapters* (interfaces). ISO/IEC/IEEE
29148 (requirements specification, FR/NFR). DDD ubiquitous language / event storming. Wirth's
stepwise refinement — design follows a precise specification, not a one-line wish.
