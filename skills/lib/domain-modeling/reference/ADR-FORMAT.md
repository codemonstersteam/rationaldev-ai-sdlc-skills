<!-- domain-modeling · companion. Opened from ../SKILL.md → "Formats". Format + placement + when-to-offer for ADRs. -->

# ADR-FORMAT — architecture decision records

## Template

```md
# {Short title of the decision}

{1–3 sentences: the context, what we decided, and why.}
```

That's it. An ADR can be a single paragraph. The value is recording **that** a decision was made and **why** —
not filling out sections.

## Placement (co-location B) + numbering

- **Context-specific** decision (local to one slice/context) → `docs/design/slice-<slug>/adr/`.
- **System-wide** decision (spans contexts / whole service) → root `docs/adr/`.
- Sequential numbering **per directory**: `0001-slug.md`, `0002-slug.md`, … Scan the target dir for the
  highest number and increment. Create the `adr/` directory **lazily** — only when the first ADR is needed.

## Offer an ADR sparingly — all three MUST be true

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder «why on earth this way?».
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

If any is missing, **skip it**. Easy to reverse → you'll just reverse it. Not surprising → nobody wonders why.
No real alternative → nothing to record beyond «we did the obvious thing».

## What qualifies

- **Architectural shape.** «The write model is event-sourced, the read model projected into Postgres.»
- **Integration patterns between contexts.** «Ordering and Billing talk via domain events, not sync HTTP.»
- **Technology choices carrying lock-in.** DB, message bus, auth provider, deployment target — the ones that
  would take a quarter to swap, not every library.
- **Boundary / scope decisions.** «Customer data is owned by the Customer context; others reference it by ID.»
  The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** «Manual SQL instead of an ORM because X» — stops the next
  engineer «fixing» something deliberate.
- **Constraints not visible in code.** «Response times < 200 ms because of the partner API contract.»

## Optional sections (only when they add value — most ADRs won't need them)

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — when decisions get revisited.
- **Considered Options** — only when the rejected alternatives are worth remembering.
- **Consequences** — only when non-obvious downstream effects need calling out.
