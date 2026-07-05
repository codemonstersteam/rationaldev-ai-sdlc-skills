<!-- domain-modeling · companion. Opened from ../SKILL.md → "Formats". Format of CONTEXT.md + CONTEXT-MAP.md. -->

# CONTEXT-FORMAT — `CONTEXT.md` structure

## Structure

```md
# {Context Name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
A customer's request to buy one or more items, tracked from placement to fulfillment.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request
```

## Rules

- **Be opinionated.** Multiple words for one concept → pick the best, list the rest under `_Avoid_`.
- **Tight definitions.** One or two sentences. Define what it **IS**, not what it does.
- **Only context-specific terms.** General programming concepts (timeouts, error types, utility patterns)
  do **not** belong, even if used heavily. Ask: unique to this context, or general? Only the former.
- **Group under subheadings** when natural clusters emerge; a flat list is fine if all terms cohere.
- `CONTEXT.md` is a **glossary and nothing else** — no implementation detail, no spec.

## Single vs multi-context (harness paths — co-location B)

**Single context (most tasks):** one root `CONTEXT.md`.

**Multiple contexts (slice = context):** a root `CONTEXT-MAP.md` lists the contexts (linking each slice's
design-package `CONTEXT.md`) and how they relate. Knowledge lives in `docs/design/slice-<slug>/`, code in
`internal/<slug>/`, bound by one `<slug>`.

```md
# Context Map

## Contexts

- [Ordering](./docs/design/slice-ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./docs/design/slice-billing/CONTEXT.md) — generates invoices and processes payments

## Relationships

- **Ordering → Billing**: Ordering emits `OrderPlaced`; Billing consumes it to generate invoices
- **Ordering ↔ Billing**: shared types `CustomerId`, `Money` (live in `internal/shared/`)
```

**Inference:** `CONTEXT-MAP.md` exists → read it to find contexts. Only a root `CONTEXT.md` → single context.
Neither → create a root `CONTEXT.md` lazily on the first resolved term. When multiple contexts exist, infer
which one the current topic relates to; if unclear, **ask**.
