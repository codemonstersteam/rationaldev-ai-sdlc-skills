<!-- program-design · step 06 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 6. Isolate I/O

**In:** the module contracts from Step 5. **Out:** autonomous I/O objects (`Store`/`Client`/`Publisher`/`Consumer`), no raw dependencies in `Deps`.

In each slice **all work with the external world is collected in I/O modules** (`*_io.go`,
`*Repository`, `*Gateway`, `*Adapter`). The slice's business logic is pure functions — no HTTP /
DB / broker / file system.

**A slice may have several I/O modules** — that's normal. A real slice often does: "receive
request → fetch state from DB → call external REST → write result to DB → publish event". That's
four different I/O, each a separate module with its own contract and failure mode. Not a reason
to split the slice — it's the natural complexity of a business operation.

The sign a slice should be split is **not the number of I/O modules, but the number of
independent use cases** in one slice. If "register a user" and "run an admin report" coexist in
one slice — that's two slices, not one with two I/O.

What **must** be in one I/O module:

- one external dependency (one DB, one broker, one external service);
- one mode of working with it (read or write, not "read and write in a row" inside one module).

Why this is right: each I/O module is checked by exactly one failure scenario in the component
tests. Cram two modes into one module and the failures mix — the component scenarios stop being
distinguishable.

#### Autonomous I/O object rule

Each I/O module is designed as an **autonomous object** encapsulating its dependency. The head
module knows only the object's methods (API), not its inner dependencies.

Object name by integration type (and the `io:` tag from Step 5 + the design sub-skill for it):

| Integration | Object name | `io:` | Design sub-skill | Dependency (hidden inside the object) |
|---|---|---|---|---|
| Database | `Store` | `db` | `db-io` | `*sql.DB` |
| External HTTP API | `Client` | `http` | `http-io` | `*http.Client` + baseURL |
| LLM / model endpoint | `Client` | `llm` | `http-io` + `llm-client` | `*http.Client` + baseURL |
| Message broker / queue | `Publisher` / `Consumer` | `queue` | `queue-io` | broker connection |

In the contract (Step 5), an I/O module's lines:
- `Input (data):` — one domain message;
- `Dependencies:` — `—` (the dependency is encapsulated in the object, the head doesn't see it);
- in the head module's `Deps` — a field of type `Store` / `Client` / `Publisher`, **not** the
  raw dependency (`*sql.DB`, `*http.Client`…).

Violation sign during design review: a raw dependency (`*sql.DB`, `*http.Client`) in a
contract's `Dependencies:` line or in the head module's `Deps`. It means the I/O object wasn't
introduced. Stop, return to Step 3.

**Design sub-skill by I/O type (deterministic, by the `io:` tag).** Once the object's `io:` is
set (Step 5), design it with the matching sub-skill — do not improvise best practices:

- `http` → `http-io` (two budgets load/payload BEFORE code; contract frozen by a machine spec →
  client, stub, fixtures derived from it);
- `llm` → `http-io` + `llm-client` (protocol, structured output, role fan-out);
- `db` → `db-io` (transactions, isolation, timeout vs unavailable as distinguishable branches);
- `queue` → `queue-io` (delivery semantics, idempotency key, DLQ, redelivery as branches).

A slice design card with such a call passes that sub-skill's design checklist before code. The
distinguishable failure branches the sub-skill enumerates are exactly the adapter branches the
component-test formula counts (`1 + Σ adapter branches`).

#### Empty-pipe rule of the I/O module

An I/O module is a **pure data pipe**: take a domain message → hand it to the external system →
return the result or an error. **No transformations, no conditional data branching.** The only
allowed branching is mapping the external system's error codes to domain errors
(`SQLITE_BUSY → ErrDBLocked`). If a method reshapes/validates/computes over the payload, that logic
belongs in a **logic module upstream**, not in the I/O module.

**Testing consequence (hard).** I/O modules are **not unit-tested** — there is nothing to test in a
pipe. We unit-test the **logic module that feeds** the I/O module: it produces the exact payload
(the contract) that enters the I/O module, and its unit tests assert that contract. We then **expect
the I/O module to pass that payload to the integration unchanged.** The I/O success branch is proven
by the slice's happy-path component scenario; its failure branches by the failure scenarios.
