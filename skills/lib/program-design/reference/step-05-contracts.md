<!-- program-design · step 05 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 5. Describe the module contracts

**In:** the module tree and the message catalog. **Out:** each module's contract (Input/Deps/antecedent/consequent).

For each slice module — a **hard contract template**:

```
### <ModuleName>

- **Signature:** `name(input: Type) -> Result<out: Type, Error>`
- **Input (data):** one domain struct, or a Request DTO, or void.
                    If there are 2+ data arguments — it violates Step 3's
                    "hard rule of the single argument": return to Step 3.
- **Dependencies (deps):** `*sql.DB`, `broker.Client`, `clock.Clock`,
                            `*Logger`, config (`RPConfig`, `JWTConfig`).
                            If there are no deps — write `—`.
- **io:** `none | http | llm | queue | db` — **mandatory on every module.**
- **What it does:** one phrase.
- **Antecedent:** conditions on the input.
- **Consequent:**
  - Success: what it guarantees on output.
  - Failure: error classes (`ErrXxx`, `ErrYyy`).
```

**The `io:` field is not a judgement — it is a fact of the module** and the sole routing key the
implementation ticket writer uses to attach io sub-skills (see `docs/04_PLANNING_PIPELINE.md` §4,
and Step 6). Fill it mechanically:

| Module kind (Step 3 / Step 6) | `io:` |
|-------------------------------|-------|
| Ingress adapter, domain constructor, pure logic, head pipe | `none` |
| `Store` object (DB) | `db` |
| `Client` object — external HTTP API | `http` |
| `Client` object — LLM / model endpoint | `llm` |
| `Publisher` / `Consumer` object — broker/queue | `queue` |

A module with `io: none` MUST have `Dependencies: —` of any external client (else it's an
un-isolated I/O — return to Step 3). A module with `io ≠ none` is an autonomous I/O object (Step 6).

This is a field-by-field frozen template. No "conversational" signature description — Input and
Dependencies always on separate lines. This insures against sliding back into a flat argument list.

#### Hard `Dependencies:` checklist (guard against raw I/O)

When filling each contract's `Dependencies:` line — a **mandatory mechanical reconciliation**
against the integration table (Step 6). If a raw external-world client appears in the
dependencies — it's a Step 6 violation of exactly the same force as the "single data argument"
violation in Step 3: return to Step 3, introduce an autonomous I/O object
(`Store`/`Client`/`Publisher`/`Consumer`), make the module its method, put `—` in `Dependencies:`.

Forbidden values in `Dependencies:` (signal of unwrapped I/O):

| Forbidden              | Integration type   | What should be instead  |
|------------------------|------------------|--------------------------|
| `*sql.DB`, `*sql.Tx`   | Database         | `—` (method of a `Store` object) |
| `*http.Client`, base URL | External HTTP API | `—` (method of a `Client` object) |
| Broker connection, broker producer/consumer | Message broker | `—` (method of a `Publisher`/`Consumer` object) |
| `*os.File`, file `io.Writer` | File system  | `—` (method of a `FileStore` object) |

Allowed values in `Dependencies:` (these are config or orthogonal tools, not integrations):

- `RPConfig`, `JWTConfig`, any value-config — not I/O.
- `clock.Clock` — deterministic time, not an integration.
- `*slog.Logger` — observability, not an integration.
- `io.Reader` for entropy (`crypto/rand.Reader`) — a borderline case; allowed in logic modules
  for testability, but **not** for I/O. In the head's `Deps` — usually not needed (see the
  `Rand` rule in "The head module — an orchestrator pipe").

**Check algorithm.** After filling each contract (Step 5) — walk each module's `Dependencies:`
line and reconcile it against the "Forbidden" column. Any one match — stop: return to Step 3,
introduce an I/O object, make this module its method. This is a mechanical check, not a creative
decision — it either passes or not.

The cost of skipping the check — on later slices the operator finds a raw `*sql.DB` in the
design and asks for a rework. The checklist was added precisely so this doesn't recur.

Clarifications:

- **I/O modules without a useful output** (publish an event, delete a record): signature —
  `Result<(), Error>` (or `error` in Go). No success payload, but success/failure is explicitly
  distinguished by the contract.
- **If the consequent can't be justified** — the module is designed wrong, keep designing.
- **If the Input doesn't fit one domain struct** — a signal that either a new domain entity is
  needed (return to Step 3 and add a constructor node), or the module does too much and should
  be cut.
