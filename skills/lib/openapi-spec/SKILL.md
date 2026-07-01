---
name: openapi-spec
description: Author the service's own OpenAPI 3.x contract for synchronous HTTP endpoints at api-specification/openapi.yaml — one frozen contract per service, derived deterministically from the slice's fully-dressed use case and failure-mode map. Use at stage 3 for a slice whose external input is HTTP; the spec then feeds contract-tests (pass C1), component-tests, and program-design Step 0. Do NOT use for async/events (asyncapi-spec) or for consumer expectations of another service's API (contract-tests). Tier-agnostic: derivation router, hard rules, validation, STOP.
version: "1.0"
status: "stable"
---

# openapi-spec.skill — the service's synchronous HTTP contract

## Purpose

**In:** the slice's fully-dressed use case (`docs/design/<slice>/use-case.md`, stage 2) + the
failure-mode map (from `requirements-intake`). **Out:** additions to the single
`api-specification/openapi.yaml` — the frozen OpenAPI 3.x contract of the service.

**One contract per service.** Each HTTP slice adds its path(s) to the same file; it is not
per-slice. The frozen spec satisfies `program-design` Step 0 and is checked by `pinout-openapi`
(`contract-tests` pass C1).

## Scope

DO:
- Turn one slice's HTTP use case into one path (+ operation) in `openapi.yaml`.
- Derive request/response/error schemas from the use case and failure-mode map.
- Keep schema names in `CONTEXT.md` glossary terms; validate before freezing.

DON'T:
- Author events/queues (that is `asyncapi-spec`).
- Fix another service's API you consume (that is `contract-tests`).
- Add endpoints not backed by a use case, or invent error codes.

## Router — does this belong here?

| Slice's external input | Skill |
|------------------------|-------|
| HTTP request/response (sync) | **openapi-spec** (this) |
| Event / message (async) | `asyncapi-spec` |
| Expectations of a provider you call | `contract-tests` |

## Procedure (deterministic, derive — do not invent)

1. **Confirm inputs.** Use case + failure-mode map present; else STOP.
2. **One path per external input.** The slice's single trigger → one `path` + one operation
   (method from the use case). 1 slice = 1 `Request`.
3. **Request schema = the one Request.** Body/params/headers are fields of that one input; a
   flag/option is a field, not a new operation.
4. **Success response.** From the use case **success guarantee** → the `2xx` response schema.
5. **Error responses 1:1 with Extensions.** Each consumer-visible Extension → one error response
   (HTTP status + `error.code`), taken verbatim from the failure-mode map row. No extra, none missing.
6. **Schemas in `components`.** Reusable schemas named in glossary terms; shared value objects
   (`Money`, `CustomerId`) defined once and `$ref`-ed.
7. **Validate & freeze.** Lint the spec (valid OpenAPI 3.x); once merged it is frozen — change the
   spec, never diverge code from it (`contract-tests` C1).

## Hard rules

- **Spec-first / frozen.** Behavior change → change `openapi.yaml` first, then code. Never the reverse.
- **Error responses exhaustive over the use case.** `#error responses (this path) == #consumer-visible Extensions == #failure-map rows` for the slice.
- **One data input.** Exactly one request body/entity per operation; 2+ → introduce a domain schema.
- **Glossary terms.** Every schema/field name is a canonical `CONTEXT.md` term.

## Traceability

```
use case Extension  →  failure-map row  →  error response (status + error.code)
```

The `error.code` and wording match across use case, failure-map, and spec — so the later
component-test scenario (stage 5) reads the same. Keep them literally aligned.

## STOP

- Use case or failure-mode map missing → STOP (stages 2 / requirements-intake first).
- The slice's input is async, not HTTP → STOP, use `asyncapi-spec`.
- An error response has no backing Extension, or an Extension has no response → STOP, reconcile;
  never invent an error code.
- A field the spec exposes is not in the glossary → STOP, pin the term first.

## Definition of Done

- `api-specification/openapi.yaml` valid; the slice's path + operation present.
- Success response from the success guarantee; error responses 1:1 with Extensions.
- Schema/field names are glossary terms; shared value objects `$ref`-ed.
- Spec ready to freeze → satisfies `program-design` Step 0 and `pinout-openapi` (C1).

## Foundations

OpenAPI Specification 3.x. Spec-first / API-first. Checked by
[`pinout-openapi`](https://github.com/codemonstersteam/pinout). Cockburn Extensions as the source
of the error surface (see `cockburn-use-case`, `requirements-intake` Step 4).
