<!-- program-design · step 00 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 0. Read the input

**In:** FRD/task, API contract, failure table, Gherkin scenarios, AGENTS/CLAUDE/README. **Out:** decision to start designing or stop.

These artifacts are **produced by the `requirements-intake` skill** (BRD → FRD → use cases →
draft contract + failure-mode map), not assumed to exist externally. Step 0 only checks they
are present and frozen.

**Mandatory input artifacts:**

- **FRD** `requirements/<slug>.md` from `requirements-intake` (problem statement, Cockburn
  use cases, actors & interfaces).
- **API contract.** For synchronous endpoints — `OpenAPI`. For events and async
  integrations — `AsyncAPI`. A mixed service (HTTP + broker) needs **both**.
- **Failure table in the README** — the failure-mode map of integrations with mandatory
  columns: `error.code`, HTTP status (or event type), headers (e.g. `Retry-After`), client
  action, operator action. This is the `## Карта режимов отказа` section; without it the
  component failure scenarios cannot be described.
- **Gherkin component scenarios** for the slice endpoints already written and committed (per
  `component-tests`): one happy path + a scenario per distinguishable failure mode, for each
  future slice endpoint. This is the **executable spec** the design is reconciled against in
  Step 8.
- `AGENTS.md`, `CLAUDE.md`, `README` — to know the project conventions.

**Hard rule.** If the FRD, the contract (`OpenAPI`/`AsyncAPI`), the README failure table, or
the Gherkin component scenarios for the future slice endpoints are missing — **design does
not start**. You MUST stop and run `requirements-intake` first (it produces the FRD, the
draft contract and the failure-mode map), then write the Gherkin scenarios, then return.

Without a contract there's nothing to design a slice on: no source of truth for the request
shape, the response, or the error codes. Without the failure table it's unclear which failure
component scenarios to write (the distinguishability rule — see `component-tests`). Without
Gherkin scenarios there's nothing to reconcile the design against for completeness: you might
design a slice that looks right by the contract but misses the executable spec's expectations
(`error.code` format in the response, headers, integration effects). Restoring these artifacts
during design = breeding mismatches between contract, code and tests. Frozen contract +
Gherkin first, then design.

If the contract exists but doesn't describe 5xx responses with `error.code`, or the failure
table is empty, or the Gherkin files exist but lack scenarios for the failure modes from the
table — same case: stop, freeze the missing pieces with the operator, then continue.
