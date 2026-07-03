---
name: http-io
description: Designing an I/O object over HTTP to a metered / rate-limited external service — LLM, linter-as-a-service, embeddings, any external API. Use when a slice needs an outbound HTTP call and you must NOT overload the provider or send excess context. Backbone — two budgets (load and payload), computed in the slice design BEFORE code. Flow — curl probe → provider machine spec (OpenAPI/AsyncAPI; if the provider has none, write your own) → client, stub and unit/component test fixtures derived from it; budgets carried into tests as assertions. For LLM specifics (OpenAI-compatible protocol, response_format, fan-out over consumer roles) see the llm-client skill. Built for a weak model (Qwen3.5-397B-A17B, ~17B active): two budget formulas, decision tables, checklists, STOP rules.
version: "1.0"
---

# http-io — discipline for outbound HTTP to a metered service

Applies to any **outbound** I/O object hiding HTTP to a billed or rate-limited service the
service **calls out** to (LLM, linter-as-a-service, embeddings, corporate API). **The service's
own inbound HTTP handler / router / ingress adapter is NOT http-io** — that is `io: none` (it
parses the incoming request, it doesn't call out). Local I/O (filesystem, stdout/file sink) is
also **out of scope** — no provider to overload, no metered context.

> **Core lesson:** I/O-object defects are closed in **design and verify-before-code**,
> not in coding. For LLM specifics — the [`llm-client`](../llm-client/SKILL.md) skill.

## The I/O object is a pure pipe (no transformations, not unit-tested)

The HTTP object only **carries data**: take the domain payload → send it to the provider →
return the response or a mapped error. **No transformations, no data branching** (the only
allowed branch is provider error → domain error). Anything that reshapes/validates/computes over
the payload is a **logic module upstream**, not this object.

**Therefore this object is NOT unit-tested.** We unit-test the **logic module that feeds** it —
its unit tests assert the exact payload (the contract) that enters the HTTP object — and we
**expect the object to send that payload to the provider unchanged.** The object's success/failure
is proven by the slice's component scenarios (and the budgets below, carried as test assertions).
See `program-design` Step 6 (empty-pipe rule) and Step 8.1.

## Two budgets — design parameters, not defaults

Every call to a metered service has two independent limits, computed **in the slice
design card before the first line of I/O code**, fixed in config, then **carried into
tests as assertions** — not "discovered" after the first 429.

| Budget | Question | Where fixed |
|---|---|---|
| **Load** | how many requests × how often ≤ provider window? | pause/concurrency in the I/O object |
| **Payload** | what and how many bytes go in one request? | input whitelist in config |

"Send everything" and "loop without a pause" are not defaults — they are **deferred outages**.

## Load budget — don't overload the provider

Computed by formula, before code:

```
N_calls_per_command × tokens_per_call  ≤  tier TPM window
N_calls_per_command                    ≤  tier RPM window
```

Fan-out over N consumer roles × ~15k tokens = tens of thousands of tokens in seconds;
on a low tier this exceeds the 1-minute TPM window → the second call hits 429, and a
pause won't help until the window resets.

**Read limits from the provider, don't hardcode** (tiers/TPM/RPM change per model — a
table in code rots): **response headers** (`*-ratelimit-tokens-remaining`,
`*-tokens-reset`, `retry-after`) are runtime truth; the **provider console** is for the
design-time "do we fit at all" estimate.

**Pacing ladder — adaptive, not a fixed sleep.** A fixed `callDelayMs` is a floor, not
a solution. Pick the first matching row top-down; which rung is a **design decision**,
fixed in the slice card with the numbers:

| Condition (N calls, hot path?) | Rung |
|---|---|
| `N` small, command **not** on a hot path | 1. Sequential + pause (from config) |
| catching 429 (provider sends `Retry-After`) | 2. Backoff on `Retry-After` (with a retry cap) |
| `N` growing, window tightening (`*-tokens-remaining` low) | 3. Adaptive pacing on remaining tokens |
| need speed and the tier allows | 4. Bounded concurrency (semaphore of `k`, sized to RPM) |

429 is a **normal scenario**, not an edge case: backoff-and-retry (rung 2+) or a domain
sentinel (`ErrLLMRateLimited`) — never a "generic HTTP error".

## Payload budget — don't send excess context

Computed from target-data size, before code:

```
tokens ≈ bytes / 4                       (rough, English/mixed text)
Σ(input size) / 4 × N_calls  must fit the TPM window
```

A ~850 KB markdown repo ≈ ~230k tokens/call × N roles ≈ ~1M tokens/command — far above
a low tier's TPM. **Input whitelist in config is mandatory** — the context boundary is
a design decision, an explicit list, not "everything recursively":

```yaml
inputs:            # the I/O object reads only what's listed
  - README.md
  - AGENTS.md
```

**Don't send** binaries, vendored/generated, duplicates, or anything the layer doesn't
need to decide. **If still too big:** truncate-with-log (silent truncation reads as
"assessed in full" — violates *no silent caps*), chunk-and-aggregate, or delta.

## Verify before code — curl-first

A minimal curl before writing the client catches most I/O defects. Check by hand:
1. **endpoint** — exact path (`/v1/chat/completions`, not `/chat/completions` — a missing `/v1` returns 400);
2. **auth** — which header (`Authorization: Bearer` vs `x-api-key`);
3. **payload/response shape** — fields, nesting;
4. **error bodies** — what 4xx/5xx returns; how to tell quota from invalid;
5. **(LLM)** `response_format` — a working variant, see [`llm-client`](../llm-client/SKILL.md).

curl proves the format is live **first**, then you code the request structure.

## Provider spec — source of truth (OpenAPI / AsyncAPI)

curl proves the contract is live; the **spec freezes it**. Order: curl probe → contract
as a machine spec → client, stub and fixtures derived from it (one source, three
artifacts don't diverge). Provider has a spec → use it; **no spec** (documented only in
prose) → **write your own** at `api-specification/providers/<name>.openapi.yaml`.

| Spec | When | Describes |
|---|---|---|
| **OpenAPI** | sync request/response | endpoint, auth, request schema (incl. `response_format`), response schema, 4xx/5xx bodies |
| **AsyncAPI** | stream/events (SSE, webhooks, queues) | channels, message format, event order |

**Scope:** spec only the endpoints and fields you actually use — same boundary as the payload budget.

## From curl to tests

The spec carries into both test layers; the two budget formulas become **assertions**.

- **Unit** (`logic.go`, pure leaves) — the I/O object itself is **not** unit-tested
  (infra). Unit-test the pure logic extracted around it: `estimateTokens` (`bytes/4`),
  `selectInputs` (whitelist), `waitFor` (pacing), response parsing (clean + fenced),
  status → failure-class mapping.
- **Component** (stub) — one scenario per distinguishable contract branch: happy shape;
  failure per `error.code` (`rate_limited`→429+`Retry-After`, `unavailable`→5xx,
  `budget_exceeded`→`usage>limit`); **payload boundary** — stub asserts the body carries
  only the whitelisted input.

> A new component scenario is justified by a **new contract branch**, not "more data".
> A formula with no new branch (exact token count, exact pause) is a **unit**.

## I/O object shape

Like all I/O in `internal/io`: an autonomous object hiding its dependency; each method
is a **pipe** (one message → external call → result/domain error); the only branching
is mapping an external code to a domain sentinel.

| Failure class | Nature | Action | LLM example |
|---|---|---|---|
| **transient** | 429, 5xx, network, timeout | backoff-retry or sentinel | `ErrLLMRateLimited` / `ErrLLMUnavailable` |
| **permanent** | 4xx-invalid, decode | sentinel at once, no retry | `ErrLLMUnavailable` (parse) |
| **quota** | `usage > limit`, missing key | fail-fast, sentinel | `ErrLLMBudgetExceeded` |

Secret from env by config name (`api_key_env`), fail-fast before I/O (no secrets in
YAML); guard token limit **above** the real max of target data; HTTP timeout explicit.

## Stub in Docker Compose

The external service in component tests is a **separate HTTP service in Compose** on the
same endpoint, not an in-code mock (skill [`component-tests`](../component-tests/SKILL.md)).
Switch mode via `POST /control {"mode":"…"}`; modes match the contract's failure modes
(`healthy`, `rate_limited`→429, `unavailable`→5xx). LLM stub specifics — [`llm-client`](../llm-client/SKILL.md).

## STOP rules

Stop and ask the operator, don't guess:
- Endpoint / auth / payload-response shape not confirmed by **curl** → STOP before code.
- Provider has no machine spec **and** the contract is unclear from curl → STOP (client and stub will diverge).
- Load / payload budget **not computed** while the slice fans out or sends a large context → STOP, compute first.
- Tier limits unknown and no source (headers / console) → STOP: don't hardcode.
- A failure mode won't fit transient / permanent / quota → STOP: no "generic HTTP error".

## Checklist — design (before I/O code) → implementation

- [ ] endpoint + auth + payload/response shape verified by **curl**
- [ ] provider machine spec exists, or your own written in `api-specification/providers/`; client and stub derive from it
- [ ] curl-captured responses (happy + errors) saved as parser unit fixtures and stub modes
- [ ] **load budget** computed (`N×tokens ≤ TPM`, `N ≤ RPM`); numbers + tier recorded
- [ ] **pacing rung** chosen, justified by `N`; pause from config, not hardcoded
- [ ] **payload budget** computed (`Σbytes/4×N < TPM`); **input whitelist** in config
- [ ] oversized-input strategy: truncate-with-log / chunk / delta
- [ ] budget formulas are **pure functions** (`estimateTokens`, `selectInputs`, `waitFor`), unit-tested
- [ ] failure modes classed transient / permanent / quota → domain sentinel (not generic HTTP error)
- [ ] secret from env (config name), fail-fast; guard token limit above real max; HTTP timeout explicit
- [ ] `baseURL` includes the version prefix (`/v1`)
- [ ] (LLM) structured output required — see [`llm-client`](../llm-client/SKILL.md)
- [ ] **component tests**: happy + transient/permanent/quota + payload boundary (stub asserts only whitelist sent); modes via `/control`

## Before commit

`gofmt -l ./internal/slice/<name>/` (empty = clean) and, on a new dependency, `go.sum`
committed + copied into `Dockerfile.runtime`. Details — [`llm-client`](../llm-client/SKILL.md) → "Before commit".
