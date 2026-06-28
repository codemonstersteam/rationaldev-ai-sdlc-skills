---
name: contract-tests
description: Deterministic procedure for contract tests between components (consumer-driven). The contract is described by a machine spec (OpenAPI/AsyncAPI), component links by a netlist; checked by the external pinout validator and its components. Use when a service calls another service/broker or exposes an API to consumers. Do NOT use for the internal logic of a single module — that is program-design + component-tests.
version: "0.1"
status: draft
---

# contract-tests — contracts between components

A contract between components is a machine artifact, not a chat agreement.
The consumer describes its expectations of the provider; if the contract is broken, CI fails before prod.

> **Who checks:** the [`pinout`](https://github.com/codemonstersteam/pinout) project and its
> components: `pinout-openapi` (REST), `pinout-asyncapi` (events/queues),
> `pinout-netlist` (the map of links between services — a "netlist" as in circuit design).
> Contracts are the source of truth about boundaries; pinout reconciles consumer and provider.

## 0. When to apply (router)

| Situation | Action |
|---|---|
| Service calls another's REST API | consumer contract in OpenAPI → `pinout-openapi` check |
| Service publishes/listens to events | contract in AsyncAPI 3.0 → `pinout-asyncapi` check |
| Several services in one feature | links in netlist → `pinout-netlist` check |
| Internal call within a module | NOT here → `program-design` + `component-tests` |

## 1. Procedure

**Pass C1 — Contract spec (spec-first).** The contract is described BEFORE code in
`api-specification/` (OpenAPI 3.x for REST, AsyncAPI 3.0 for events). Change the contract —
change the spec, not the other way around.
(Check: the spec exists and is valid.)

**Pass C2 — Consumer-driven expectations.** The consumer fixes exactly what it uses
(fields, response codes, event format). This is the contract test: a minimal slice, not the whole spec.
(Check: expectations are tied to specific fields/codes.)

**Pass C3 — Register in netlist.** The "consumer → provider" link is added to the
netlist (`pinout-netlist`): who calls whom, which contract. One component = one node.
(Check: the edge exists in the netlist and references the C1 spec.)

**Pass C4 — Check in CI.** `pinout` reconciles: the provider spec covers the consumer's
expectations; the netlist is consistent (no dangling/contradictory links). **Contract failure =
block before prod** (treated as a hard violation).
(Check: pinout report is green in CI before merge.)

## 2. STOP rules

- The contract changes without changing the spec → You MUST stop (API-first violation).
- The consumer depends on a field outside the contract → You MUST stop, extend the contract or remove the dependency.
- The netlist is inconsistent (provider removed a field the consumer uses) → CI fails, do NOT merge.
- No spec, but the decomposition requires a cross-service call → You MUST stop, spec first.

## 3. Output

- Specs in `api-specification/` (OpenAPI/AsyncAPI).
- An entry in the netlist (`pinout`).
- A green `pinout` report in CI as a merge condition.

> Contract tests complement **component** tests (service behavior as a black box) and
> **mathematical composition** (correctness of modules inside). Together they cover
> quality without test environments: internal correctness — by composition, external — by
> contracts, behavior — by component tests, prod health — by the 4 golden signals.
