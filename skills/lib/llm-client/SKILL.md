---
name: llm-client
description: LLM specifics of the I/O object talking to a model (Anthropic / OpenAI-compatible) — protocol choice (OpenAI chat completions), structured output via response_format, fan-out over consumer roles, role marker in the stub, fixing real model responses. Use together with http-io (the shared outbound-HTTP discipline — load/payload budgets, provider spec, failure modes, stub). Do NOT use for picking a model for a task — that is a separate decision. Built for a small-tier model: decision tables, fixed templates, checklists, STOP rules.
version: "1.0"
---

# llm-client — model-interaction specifics

> **Shared outbound-HTTP discipline is in the [`http-io`](../http-io/SKILL.md) skill:**
> two budgets (load and payload), curl probe, provider spec (OpenAPI/AsyncAPI),
> pacing/backoff, transient/permanent/quota failure classes, stub in Compose, the
> "from curl to tests with the formulas" bridge. This skill is the **LLM specifics**
> on top of that discipline: protocol, `response_format`, role fan-out, fixing
> responses. Anchored on a real `LLMClient` implementation
> (`internal/<slug>/io.go`, slice devlog).

---

## Protocol: OpenAI-compatible layer, not the native API

Use the **OpenAI chat completions format** (`POST /v1/chat/completions`) even for
Anthropic. Reason: one codebase works with any provider — Anthropic, OpenAI, local
Ollama, corporate proxy.

```
Anthropic base URL: https://api.anthropic.com/v1
Endpoint:          POST {base_url}/chat/completions
Auth header:       Authorization: Bearer <key>
```

The native Anthropic API (`POST /v1/messages`, `x-api-key` header,
`anthropic-version` field) is **not used**. It offers more (thinking, citations) but
breaks provider-agnosticism.

**Trap:** a default `baseURL = "https://api.anthropic.com"` without `/v1` gives
`POST https://api.anthropic.com/chat/completions` — 404 or 400. Always include `/v1`
in `baseURL` (the curl probe catches this before code — see `http-io`).

Machine spec of this provider slice —
`api-specification/providers/anthropic-openai-compat.openapi.yaml` (client structs and
stub derive from it; see `http-io` → "Provider spec").

---

## Structured output — mandatory

Without `response_format` the model wraps JSON in a markdown block
(` ```json ... ``` `), even when explicitly told "JSON only". This breaks parsing —
the output format is set by an API mechanism, not by an instruction in the text.

**Correct request for Anthropic (OpenAI layer):**

```json
{
  "model": "claude-sonnet-4-6",
  "messages": [...],
  "max_tokens": 4096,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "verdict",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "status": {"type": "string", "enum": ["PASS", "FAIL", "PARTIAL"]},
          "score":  {"type": "integer"},
          "gaps":   {"type": "array", "items": {"type": "string"}}
        },
        "required": ["status", "score", "gaps"],
        "additionalProperties": false
      }
    }
  }
}
```

**`response_format` traps on Anthropic** (three curl iterations, recorded in the slice devlog):
- `"type": "json_object"` → 400 `Input should be 'json_schema'`
- no `"strict": true` → 400 `Field required`
- no `"additionalProperties": false` → 400 on some schemas

With `json_schema + strict: true + additionalProperties: false` the model returns
clean JSON as a string in `choices[0].message.content`, no wrappers.

**Fallback parsing** stays as a second echelon — for a provider that does not support
`response_format`:

```go
// extractJSON cuts the first JSON object out of the model's response string,
// ignoring markdown wrappers and any surrounding text.
func extractJSON(s string) string {
    start := strings.Index(s, "{")
    end := strings.LastIndex(s, "}")
    if start == -1 || end == -1 || end < start {
        return s
    }
    return s[start : end+1]
}
```

`extractJSON` is unit-tested on "clean JSON" and "```json``` wrapper" fixtures
(see `http-io` → "From curl to tests").

---

## Fan-out over consumer roles

If a task needs an independent assessment from several consumers,
`Ask(PromptSet) -> []Verdict` makes **N independent calls** (one per role), each over
the same input corpus under its own role prompt. Results are **not averaged** — N
independent scores.

For example, roles maintainer / consumer / manager / agent each look at the same
documentation corpus from their own viewpoint. The count and set of roles depend on
the slice; the scheme "one corpus → N prompts → N independent verdicts" is universal.

These are N sequential calls → they fall straight under the load budget and pacing from
[`http-io`](../http-io/SKILL.md): `N × tokens/call ≤ TPM`, pause/backoff between calls.
Role prompts live in config (`prompts:`), tunable without a rebuild.

---

## Stub: distinguishing roles by a `role:<key>` marker

Shared stub mechanics (a separate HTTP service in Compose, same endpoint,
`POST /control` for the mode) are in [`http-io`](../http-io/SKILL.md). LLM specific: the
stub tells verdicts apart by role via a `role:<key>` marker in the prompt body.
**Default prompts MUST carry this marker.**

```go
func detectRole(r *http.Request) string {
    b, _ := io.ReadAll(r.Body)
    body := strings.ToLower(string(b))
    for _, role := range []string{"maintainer", "consumer", "manager", "agent"} {
        if strings.Contains(body, "role:"+role) {
            return role
        }
    }
    return "maintainer"
}
```

The real provider ignores the marker; the stub reacts deterministically. This lets you
specify role independence and the non-averaging of scores. An extra LLM stub mode
`markdown_fenced` (verdict in a ```json``` wrapper) specifies that the client MUST cope
with a response that has no `response_format`.

---

## Test data: fix real model responses

On the first successful run against a real model — save the response to
`component-tests/testdata/real-responses/<repo>-<slice>.json`:

```json
{
  "_meta": {
    "source": "real Sonnet (claude-sonnet-4-6)",
    "repo": "<target repository>",
    "docs_checked": ["README.md", "CLAUDE.md", "CONTRIBUTING.md", "AGENTS.md"],
    "date": "YYYY-MM-DD"
  },
  "result": { ... }
}
```

From this data — a dedicated stub mode (`good_repo`, `bad_repo`): the stub returns the
fixed verdicts deterministically, reproducing real-model behavior without the network.
Cover at least two variants:
- **Good input** (some roles FAIL/PARTIAL — this is normal, not a failure);
- **Bad input** (all roles FAIL, score 2–3, gaps about missing content).

---

## STOP rules

Stop and ask the operator, don't guess:

- Provider does not support `response_format` / `json_schema` (curl showed 400) → STOP,
  agree the fallback strategy (`extractJSON` as a second echelon is a decision, not a
  silent default).
- Response shape did not match the fixed provider spec
  (`api-specification/providers/<name>.openapi.yaml`) → STOP: client and stub must
  derive from one contract.
- No real model response to fix into a fixture (`testdata/real-responses/`) → STOP, get
  a run on a real model: the stub reproduces a fixed response, not an invented one.

## LLM-specific checklist

(the general outbound-HTTP checklist is in [`http-io`](../http-io/SKILL.md))

- [ ] protocol — OpenAI chat completions; `baseURL` with `/v1`; `Authorization: Bearer`
- [ ] `response_format.type = "json_schema"` + `strict: true` + `additionalProperties: false`
- [ ] fallback `extractJSON` after `response_format`, unit test on clean + fenced
- [ ] role fan-out (if the slice has it); verdicts not averaged; role prompts in config
- [ ] default prompts carry the `role:<key>` marker; stub tells the role by it
- [ ] LLM stub mode `markdown_fenced`
- [ ] real responses saved in `testdata/real-responses/`; modes `good_repo`/`bad_repo`

---

## Before commit

Two mandatory steps — systemic CI failures from practice (common to all slices, here
because the new dependency and I/O appeared exactly here):

**1. gofmt**

```bash
gofmt -l ./internal/<slug>/     # empty = clean; otherwise gofmt -w
```

Check every `.go` file of the slice before each commit. A gofmt failure in CI is a sign
of a skipped step, not a new rule.

**2. go.sum in the Dockerfile**

If the slice gained a new dependency (`go.mod` changed):
- `go.sum` committed (`git add go.sum`);
- `Dockerfile.runtime` copies both files:
  ```dockerfile
  COPY go.mod go.sum ./
  RUN go mod download
  ```

Without `go.sum` in the image, `go build` fails with
`missing go.sum entry for module providing package <dep>` even if go.sum is in the repo.
