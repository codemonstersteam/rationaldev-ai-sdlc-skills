---
name: queue-io
description: Designing an I/O object over a message broker / queue (Kafka, RabbitMQ, SQS, NATS…) — Publisher (send) or Consumer (receive). Use when a slice's external input/output is async messaging (io: queue). Backbone — delivery semantics decided in the slice design BEFORE code: at-least-once + idempotency key, ordering, ack-after-process, DLQ + redelivery policy. The object is a pure pipe (no transformations, not unit-tested); its distinguishable adapter branches are the component-test failure scenarios. Pairs with asyncapi-spec (the frozen contract). Do NOT use for sync HTTP (http-io) or module logic (program-design). Tier-agnostic: decision tables, adapter-branch list, checklist, STOP.
version: "1.0"
status: "stable"
---

# queue-io — discipline for a broker / queue I/O object

Applies to any I/O object hiding a message broker or queue (`io: queue`): a `Publisher`
(send) or a `Consumer` (receive). The contract is frozen by `asyncapi-spec`
(`api-specification/asyncapi.yaml`); this skill designs the object and its failure surface.

> **Core lesson:** messaging defects (lost/duplicated/reordered/poison messages) are closed in
> **design** — delivery semantics decided before code — not in coding.

## The I/O object is a pure pipe (no transformations, not unit-tested)

The Publisher/Consumer only **carries data**: take the domain message → hand it to / take it from
the broker → return the result or a mapped error. **No transformations, no data branching** (the
only allowed branch is broker error → domain error). Reshaping/validating/computing over the
payload is a **logic module upstream**, not this object.

**Therefore this object is NOT unit-tested.** Unit-test the **logic module that builds the
message** — its unit tests assert the exact payload (the contract) that enters the Publisher, and
we **expect the Publisher to hand it to the broker unchanged.** For a Consumer, unit-test the logic
that processes the decoded message, not the receive/ack pipe. Success/failure is proven by
component scenarios. See `program-design` Step 6.

## Delivery semantics — design parameters, not defaults

Decide these **in the slice design card, before code**, and record the choices:

| Parameter | Question | Default to pick unless justified |
|-----------|----------|----------------------------------|
| **Delivery** | at-least-once / at-most-once / exactly-once? | **at-least-once** (exactly-once is usually a myth) |
| **Idempotency** | how does the consumer dedupe redeliveries? | **idempotency key** on the message; dedupe on it |
| **Ordering** | must messages keep order? by what key? | ordering **not** assumed unless a partition/FIFO key is stated |
| **Ack** | ack before or after processing? | **ack after** successful processing (at-least-once) |
| **Redelivery / DLQ** | how many retries, then where? | bounded retries → **DLQ**; never infinite redelivery |

**At-least-once ⇒ the consumer MUST be idempotent.** This is not optional: redelivery will happen
(rebalance, timeout, redeploy). No idempotency = duplicate side effects in prod.

## Distinguishable adapter branches (→ component scenarios)

The failure surface the component-test formula counts (`1 + Σ adapter branches`). Two modes collapse
into one branch if status + client action + operator action all match; otherwise they are separate.

| Branch | Nature | Domain sentinel (example) | Consumer/Publisher action |
|--------|--------|---------------------------|---------------------------|
| broker unavailable | transient | `ErrBrokerUnavailable` | publish: retry/backoff; consume: pause |
| publish rejected (too large / bad topic) | permanent | `ErrPublishRejected` | fail-fast, no retry |
| redelivery limit exceeded | poison | `ErrPoisonMessage` | route to **DLQ**, alert operator |
| decode / schema mismatch | permanent | `ErrMessageInvalid` | DLQ, do not ack as success |
| ack/commit failure | transient | `ErrAckFailed` | reprocess (safe under idempotency) |

Each distinguishable branch = one component failure scenario, named verbatim from the AsyncAPI
failure surface / use-case Extension (`asyncapi-spec`, `cockburn-use-case`).

## I/O object shape

Autonomous object in `internal/io` hiding the broker connection; each method is a **pipe**:

- **Publisher:** `Publish(msg) -> error` — send one message; map broker error → sentinel; carry the
  **idempotency key**. No success payload beyond ok/err.
- **Consumer:** `Receive() -> (msg, ack, error)` — deliver one decoded message + an `ack`/`nack`
  handle; **ack only after** the slice head reports success; `nack`/redeliver on transient failure;
  route to DLQ on poison.

The head's `Deps` holds `Publisher`/`Consumer`, **not** the raw broker connection (`program-design`
Step 6). Broker credentials from env by config name, fail-fast before I/O.

## Contract & stub

- **Contract:** the channel/operation/message + failure surface are frozen by `asyncapi-spec`.
  Design only the channels/fields the slice uses (same boundary discipline as `http-io`).
- **Stub in Docker Compose:** a **real broker** (or a protocol-faithful stub) as a Compose service,
  not an in-code mock (`component-tests`). Drive failure modes (unavailable, poison→DLQ) via broker
  config/control, matching the contract's failure modes.

## From design to tests

- **Unit** — the object is **not** unit-tested. Unit-test the pure logic around it: the
  message-builder (produces the payload/idempotency key), the decode→domain mapping, and the
  broker-code → sentinel mapping (a pure function).
- **Component** — one scenario per distinguishable adapter branch (table above) + the happy path;
  assert idempotency (a redelivered message causes no duplicate effect) as its own scenario when the
  slice has an observable side effect.

## STOP rules

Stop and ask the operator, don't guess:
- Delivery semantics / ordering / ack strategy **not decided** before code → STOP, decide first.
- At-least-once chosen but the consumer has **no idempotency key / dedupe** → STOP (duplicate effects).
- No DLQ / no retry cap (infinite redelivery risk) → STOP.
- A failure mode won't fit transient / permanent / poison → STOP, no "generic broker error".
- No frozen `asyncapi.yaml` for the channel → STOP, run `asyncapi-spec` first.

## Checklist — design (before I/O code) → implementation

- [ ] delivery semantics chosen (at-least-once default) + recorded in the slice card
- [ ] **idempotency key** defined; consumer dedupes on it (mandatory under at-least-once)
- [ ] ordering requirement stated (partition/FIFO key) or explicitly "not required"
- [ ] **ack after processing**; nack/redelivery + **bounded retries → DLQ** designed
- [ ] adapter branches enumerated (table) → each is a component scenario; `1 + Σ` matches
- [ ] object is a pure pipe; `Deps` holds `Publisher`/`Consumer`, not the raw connection
- [ ] channel/message frozen in `asyncapi.yaml`; only used fields specced
- [ ] broker error → domain sentinel (transient / permanent / poison), not generic
- [ ] secret from env (config name), fail-fast before I/O
- [ ] component tests: happy + each adapter branch + **idempotency (redelivery → no dup effect)**; broker as a Compose service

## Foundations

At-least-once + idempotency, ordering keys, DLQ / poison-message handling (Kafka / RabbitMQ / SQS
patterns). Pairs with `asyncapi-spec` (contract), `program-design` Step 6 (I/O isolation, pure
pipe), `component-tests` (`1 + Σ adapter branches`), `http-io` (sibling for sync egress).
