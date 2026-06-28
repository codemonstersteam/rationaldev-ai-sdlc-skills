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

Object name by integration type:

| Integration | Object name | Dependency (hidden inside the object) |
|---|---|---|
| Database | `Store` | `*sql.DB` |
| External HTTP API | `Client` | `*http.Client` + baseURL |
| Message broker | `Publisher` / `Consumer` | broker connection |

In the contract (Step 5), an I/O module's lines:
- `Input (data):` — one domain message;
- `Dependencies:` — `—` (the dependency is encapsulated in the object, the head doesn't see it);
- in the head module's `Deps` — a field of type `Store` / `Client` / `Publisher`, **not** the
  raw dependency (`*sql.DB`, `*http.Client`…).

Violation sign during design review: a raw dependency (`*sql.DB`, `*http.Client`) in a
contract's `Dependencies:` line or in the head module's `Deps`. It means the I/O object wasn't
introduced. Stop, return to Step 3.

**Outbound HTTP to a rate-limited service** (external REST/LLM/any rate-limited endpoint) is
designed by the `http-io` skill: two budgets (load/payload) computed BEFORE code, the contract
frozen by a machine spec, from which the client, stub and fixtures are derived. A slice design
card with such a call passes the `http-io` design checklist before code.

#### Empty-pipe rule of the I/O module

An I/O module contains no business logic. Each object method is a pipe: take a domain message →
call the external system → return the result or an error. No conditional data branching, no
transformations. The only allowed branching is mapping the external system's error codes to
domain errors (`SQLITE_BUSY → ErrDBLocked`).

I/O modules are **not unit-covered**: the success branch greens the happy-path component
scenario, the failure branches green the failure scenarios.
