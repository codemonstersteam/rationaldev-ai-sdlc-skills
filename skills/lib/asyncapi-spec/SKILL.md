---
name: asyncapi-spec
description: Author the service's own AsyncAPI 3.0 contract for asynchronous messaging (events, queues, brokers) at api-specification/asyncapi.yaml — one frozen contract per service, derived deterministically from the slice's fully-dressed use case and failure-mode map. Use at stage 4 for a slice whose external input is a consumed message or whose output is a published event; the spec then feeds contract-tests (pass C1, pinout-asyncapi), component-tests, and program-design Step 0. Do NOT use for synchronous HTTP (openapi-spec) or for consumer expectations of another service (contract-tests). Tier-agnostic: derivation router, hard rules, validation, STOP.
version: "0.1"
status: "draft"
---

# asyncapi-spec.skill — the service's asynchronous messaging contract

## Purpose

**In:** the slice's fully-dressed use case (`docs/design/<slice>/use-case.md`, stage 2) + the
failure-mode map. **Out:** additions to the single `api-specification/asyncapi.yaml` — the frozen
AsyncAPI 3.0 contract of the service.

**One contract per service.** Each async slice adds its channel(s)/operation(s) to the same file.
The frozen spec satisfies `program-design` Step 0 and is checked by `pinout-asyncapi`
(`contract-tests` pass C1).

## Scope

DO:
- Turn one slice's messaging use case into channels + operations + messages.
- Derive message schemas and the failure surface (error events / DLQ) from the use case.
- Keep message/schema names in `CONTEXT.md` glossary terms; validate before freezing.

DON'T:
- Author sync HTTP (that is `openapi-spec`).
- Fix another service's contract you consume (that is `contract-tests`).
- Add channels not backed by a use case, or invent message types.

## Router — does this belong here?

| Slice's external input / output | Skill |
|---------------------------------|-------|
| Consumes a message / publishes an event (async) | **asyncapi-spec** (this) |
| HTTP request/response (sync) | `openapi-spec` |
| Expectations of a broker/service you call | `contract-tests` |

## Procedure (deterministic, derive — do not invent)

1. **Confirm inputs.** Use case + failure-mode map present; else STOP.
2. **Channel per address.** The slice's message address (topic/queue) → one `channel`.
3. **Operation = direction.** `receive` if the service consumes (the trigger), `send` if it
   publishes. 1 slice = 1 primary operation = 1 `Request`.
4. **Message schema = the one payload.** Payload fields (+ headers/key) modeled as one message;
   an option is a field, not a new operation.
5. **Success outcome.** From the success guarantee → the produced event / ack, if any.
6. **Failure surface 1:1 with Extensions.** Each consumer-visible Extension → its async outcome
   (error event, DLQ routing, nack/redelivery), taken verbatim from the failure-map row.
7. **Schemas in `components`.** Reusable message payloads/value objects defined once and `$ref`-ed.
8. **Validate & freeze.** Lint (valid AsyncAPI 3.0); once merged it is frozen — change the spec,
   never diverge code from it.

## Hard rules

- **Spec-first / frozen.** Behavior change → change `asyncapi.yaml` first, then code.
- **Failure surface exhaustive over the use case.** Every consumer-visible Extension has a defined
  async outcome (event / DLQ / nack); none missing, none invented.
- **One payload.** Exactly one message payload per operation; 2+ → introduce a domain message.
- **Glossary terms.** Every message/schema/field name is a canonical `CONTEXT.md` term.
- **Delivery semantics stated.** The operation records its delivery guarantee (at-least-once, etc.)
  and idempotency key — these become adapter branches in `queue-io` and unit-test boundaries.

## Traceability

```
use case Extension  →  failure-map row  →  async outcome (error event / DLQ / nack)
```

The names/wording match across use case, failure-map, and spec so the later component-test
scenario (stage 5) reads the same. Keep them literally aligned.

## STOP

- Use case or failure-mode map missing → STOP (stages 2 / requirements-intake first).
- The slice's input is sync HTTP → STOP, use `openapi-spec`.
- An Extension has no async outcome, or a defined outcome has no Extension → STOP, reconcile;
  never invent a message type.
- A message field is not in the glossary → STOP, pin the term first.

## Definition of Done

- `api-specification/asyncapi.yaml` valid; the slice's channel + operation + message present.
- Success outcome from the success guarantee; failure surface 1:1 with Extensions.
- Delivery semantics + idempotency key recorded; names are glossary terms.
- Spec ready to freeze → satisfies `program-design` Step 0 and `pinout-asyncapi` (C1).

## Foundations

AsyncAPI 3.0 (channels, operations `send`/`receive`, messages). Spec-first / API-first. Checked by
[`pinout-asyncapi`](https://github.com/codemonstersteam/pinout). Cockburn Extensions as the source
of the failure surface (see `cockburn-use-case`, `requirements-intake` Step 4).
