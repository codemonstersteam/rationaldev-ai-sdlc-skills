---
name: architecture
description: Design a change within module boundaries plus a network-connectivity map. Use during PLANNING (planner) and PLAN REVIEW (plan-reviewer) to identify affected components and adjacent systems, record new network paths for security, and keep the change agent-ready (1–2 modules). Do NOT use for the internals of a single module (that is program-design) or for writing code (code-style).
version: "1.0"
---

# architecture — module boundaries and network connectivity

A domain skill for planner and plan-reviewer (`large` tier): fit a change into the existing
landscape, keep it within module boundaries (agent-ready), and document network connectivity
for security.

## What you must do

When planning a feature you **MUST**:

1. Identify which system components the task touches (services, DBs, queues, external APIs).
2. Describe which **adjacent systems** are involved and exactly how they interact (sync/async, protocol, direction).
3. Record new or changed **network paths** between components — this goes to security for opening firewall access.
4. Check the change against the org architecture principles below.

## Context sources

Before planning, load and use:

- `.agent/network-topology.md` — current component connectivity map.
- `.agent/contracts/` — active API contracts of adjacent systems.
- Service README and ADRs (architecture decision records), if present in the repo.

If no connectivity map or contracts exist, that is a signal: ask the human (orchestrator) a
clarifying question. You **MUST NOT** invent topology.

## Architecture principles (MUST follow)

- **Decoupling via contracts.** Every inter-service interaction goes through an explicit, versioned contract. An incompatible contract change is **forbidden** without a migration plan.
- **Async by default for inter-service.** A synchronous call between services **MUST** be justified in the plan — why an event/queue won't do.
- **No new direct access to another service's DB.** Reach another service's data only through its API.
- **Idempotency for every state-changing operation** (redeliveries are inevitable).
- **No new external network dependencies without explicit mention in the plan** (each new dependency = a new network path = a security task).

## Output artifact

In `plan.md`, section `## Архитектура изменения`:

```markdown
## Архитектура изменения

### Affected components
- service-payments (change)
- service-notifications (new event consumer)

### Interactions
| From | To | Type | Protocol | Direction |
|------|----|------|----------|-----------|
| service-payments | kafka:payments.completed | async | Kafka | publish |
| service-notifications | kafka:payments.completed | async | Kafka | subscribe |

### New network paths (for security)
| Source | Destination | Port | Protocol | Rationale |
|--------|-------------|------|----------|-----------|
| service-notifications | smtp-gateway | 587 | TLS | sending email notifications |

### Principle compliance
- [x] Interaction via event, not synchronous call
- [x] Idempotency ensured by payment_id key
- [ ] New network path — requires a security ticket
```

Also update `.agent/network-topology.md` with the new links.

## Agent-ready architecture

The context limit is fundamental and won't go away cheaply. The system **MUST** be sliced so an
agent can work meaningfully on one piece without ever loading the whole. An agent's unit of work
= what fits in its context together with everything needed to change it correctly: the module's
code, its contracts, its tests, its rules. If one task requires holding half the system in mind,
the architecture is not agent-ready.

When planning you **MUST** keep the change within module boundaries. If the task breaks them,
explicitly add a plan step: "first decompose/refactor boundaries, then the feature."

### Module requirements

1. **Bounded size.** The whole module fits in context with its tests and contracts, with margin. Reference ceiling: `<CALIBRATE: ~X lines / Y tokens for your model's working context window>`. Exceeding it triggers decomposition.
2. **Explicit, stable boundaries.** The module explicitly states what it exposes (contract) and what is internal. Internals change freely; the external surface changes only via a versioned contract. **No** access to another module's internals bypassing its contract.
3. **Minimal, explicit coupling.** Outbound links are enumerable. Async via events is preferred over sync calls. Cyclic dependencies between modules are **forbidden** (a cycle = one module, not two).
4. **Context locality.** Everything to work on this module sits next to its code: contracts, tests at all levels, a local README/ADR for non-obvious behavior. If understanding the module requires opening five neighbors, locality is broken.
5. **Layering inside the module.** Clear separation of layers (domain / application / infrastructure adapters). A predictable uniform structure beats a "pretty" one — agents work better on uniformly built modules.
6. **Contract as the unit of compatibility.** Inter-module interaction only via contract; the contract is the primary artifact, updated before implementation. An incompatible change ships with a migration plan.
7. **Idempotency and fault tolerance at boundaries.** Every state-changing interaction is idempotent; a neighbor's failure is handled explicitly. This lets the agent reason locally without holding global races in mind.
8. **Testability in isolation.** The module is testable without standing up the whole system (neighbors are stubs/mocks, contracts checked separately). If it can't be tested in isolation, the boundaries leak.

### Output artifact

In `plan.md`, section `## Границы изменения`:

```markdown
## Границы изменения

### Affected modules
- module-notifications (primary, change within boundaries)

### Agent-ready check
- [x] Change fits within 1 module's boundaries
- [x] Module fits in context with tests and contracts
- [x] No bypassing others' boundaries / direct access to another's DB
- [x] No new cyclic dependencies introduced
- [ ] Boundary refactor needed before feature: no
```

## STOP gate

You **MUST** stop and hand back to the human (orchestrator) — do not invent topology — when the
connectivity map or contracts are missing, or when the change cannot be kept within 1–2 modules
without a boundary refactor. Surface the refactor as an explicit plan step first.

## Self-check checklist

- [ ] All affected components listed
- [ ] All adjacent systems and interaction types described
- [ ] New network paths broken out into a separate table for security
- [ ] No incompatible contract changes without a migration plan
- [ ] No direct access to others' DBs
- [ ] `network-topology.md` updated
- [ ] Change fits within one or two modules (agent-ready)
- [ ] Affected modules fit in context with tests and contracts
- [ ] No cyclic dependencies introduced between modules
- [ ] If boundaries are broken, the plan has a refactor step before the feature
