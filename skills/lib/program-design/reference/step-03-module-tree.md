<!-- program-design · step 03 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 3. For each slice, design the module tree

**In:** the slice table from Step 2. **Out:** each slice's module tree + head-pipe pseudocode.

Top-down, by stepwise refinement. One slice — one tree. A slice's structure always includes:

- **ingress adapter** — **parsing only**: external representation → typed `Request`. The
  concrete form depends on the slice's input type (HTTP / Broker / gRPC / CLI — see Step 2).
  No business validation.
- **slice head module** — orchestrator: calls the domain-command constructor (validation),
  describes the execution pipe, calls the logic and I/O modules, returns the result.
- logic modules — **domain-struct constructors** and pure functions over them (tree leaves).
  All validation lives here, via constructors `NewT(raw) -> (T, error)`. Invalid data → the
  struct is not built, the constructor returns an error.
- the slice's I/O module (DB write/read, event publish, external API call).

Schema:

```
ingress adapter (parsing only)
     |
     v
slice head module (orchestrator)
     |
     +--> domain-struct constructors (validation)
     +--> logic modules over validated structs
     +--> I/O module
```

Each node is a module with **one input and one output**. Each node carries a "what it does"
phrase, in one sentence.

#### Mapping a slice onto code (package files)

Each slice is a **self-contained package** `internal/slice/<name>/` with a strict file set;
the tree nodes map onto them one-to-one:

| File | Tree node |
|---|---|
| `head.go` | **head** `Process<Slice>(req, deps) -> Result<…, Error>` |
| `adapter.go` | ingress adapter (parsing) |
| `logic.go` | domain-struct constructors and pure functions |
| `domain.go` | slice-specific types/messages |
| `errors.go` | slice sentinel errors |
| `register.go` | `Deps` + wiring the slice to its entry point |

The head is named `Process<Slice>` and lives in `head.go` — visible at once. **Do not** hide
the head/adapter behind a delegating wrapper: they're exported directly. Cross-cutting things
(report/response types, autonomous I/O objects, shared egress) go in shared packages
(`internal/{domain,io,cli}`), not in the slice.

#### Hard rule of the single argument (data vs deps)

"One input" is read literally: **each tree node takes exactly one `data` entity** on input —
either a domain struct (`Command`, `Entity`, `RegistrationSession`), or a `Request` DTO from
the ingress adapter, or nothing (for generator modules).

Dependencies (`deps`) — `*sql.DB`, broker client, `clock.Clock`, config (`RPConfig`,
`JWTConfig`), logger — are **not data**. They're injected from the side (via DI / receiver /
closure / context) and declared in the spec on a separate `Dependencies:` line (see Step 5).

**Check algorithm.** For each tree node count the data arguments (everything that isn't deps):

- 0 or 1 — the module is contracted, move on.
- 2 or more — **stop**. Introduce a domain entity that unites these arguments, and add a
  **separate constructor node** (`NewT(...)`) to build it higher up the pipe. Recount.

**Anti-example (how NOT to).**

```
persistRegistrationSession(id, handle, challenge, ttl, db) -> error
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^  ^^
                          4 data arguments            dep
```

A signature with five "leaking" fields. By the discipline — stop.

**How to.**

```
NewRegistrationSession(id, handle, challenge, ttl, now)  -> RegistrationSession
                                                            (domain entity)
persistRegistrationSession(s)                             -> error  [dep: db]
```

A new constructor node `NewRegistrationSession` appears; the I/O module has one data argument.
The head pipe grew by one line — a **cheap price** for domain encapsulation and readability.

#### Hard rule of the single request and branches (defect lesson D1)

**1. Single request (1 slice = 1 external input = exactly one `Request`).** All external
parameters are collected into **one `Request`**, and only it enters the ingress/head. A CLI
flag/option = a **`Request` field**, not a separate module argument and not a side-injection.
`os.Args` (and any parse of external input) is parsed **only in `adapter.go`**. **Forbidden**
to carry an external choice past `Request`: no "`stdout io.Writer` on the side" — "where to
write" is `req.Out`, "in what format" is `req.Format`. The violation symptom = defect D1: an
option is honored on one path and lost on another.

**2. A branch on a `Request` field = pure logic, a unit.** A choice on a field
(`resolveDestination(req) -> Destination`, `renderReport(report, format)`) is a **logic
module**, covered by a unit by the formula `1 happy + Σ branches` (Step 8.1). It is **not** a
component scenario. The I/O pipe gets a ready plan (`Destination`) and only writes — no
data branching.

**3. No test-only second I/O method.** Don't add a `WriteTo(io.Writer)` next to `Write(out)`
"for the test": such a seam becomes a production path bypassing `req.Out` (the D1 root). The
"where/how" decision moves to logic (point 2) — the seam isn't needed.

**4. The output matrix doesn't bloat the component tests.** Combinations `stdout|file × json|md`
are checked by **units** (`resolveDestination`, `renderReport`); the component scenarios
(`N = 1 + #extensions`, Step 8) include only the **write failure** mode. See `component-tests`
"Boundary with the unit layer".

#### Hard rule of invariant checking: subtype, not guard

If a **logic** pipe step gets the signature `name(input: Domain) -> Result<(), Error>` (or
`(input) -> error` in Go), and the step's only purpose is to reject the input with an error —
**that's a signal**.

Such a step is a guard. The invariant isn't anchored in the type: after `checkX(entity)` the
`entity` struct is unchanged, and any other code can accept it without the check. The step is
easy to forget, reorder or duplicate; the pipe gets a "dangling" node that computes nothing.

This rule does **not** apply to I/O modules with the effect signature `Result<(), Error>` —
publishing an event, deleting a record, a write-tx without returning an ID. They have no
"useful output" to encode into the type; they're pipes (see Step 5 and Step 8.1).

**How to fix.** Introduce a subtype that carries the invariant in the type. Replace the guard
with a subtype constructor.

**Anti-example (how NOT to).**

```
ProcessX(req) -> Response:
    | NewCommand(req)                  -> Command
    | loadEntity(cmd.id)               -> Entity
    | checkEntityFresh(entity, now)    -> ()             <-- guard
    | doWork(entity)                   -> WorkResult
```

`checkEntityFresh` is a guard: signature `-> ()` (or `-> error` in Go) with no useful output.
In — `Entity`, out — the same `Entity` lives on in the pipe as if nothing happened.

**How to.**

```
ProcessX(req) -> Response:
    | NewCommand(req)                            -> Command
    | loadEntity(cmd.id)                         -> Entity
    | NewFreshEntity({entity, now})              -> FreshEntity   <-- subtype constructor
    | doWork(fresh)                              -> WorkResult
```

`FreshEntity` is a separate domain struct with unexported fields.
`NewFreshEntity(input) -> (FreshEntity, error)` checks the invariant (`now < entity.ExpiresAt()`);
invalid data → the struct isn't created, a domain error is returned (`ErrEntityExpired`).

Later pipe steps take `FreshEntity`, not `Entity`. The type system guarantees you can't
accidentally pass an expired entity into `doWork` — the code won't compile.

**Applicability.** This extends "validation — through constructors" (Step 4) from primitives to
domain entities. Any invariant over an already-valid domain struct that needs an external fact
(current time, signature, another entity's status, passing verification) is shaped as a subtype
constructor, not a guard function. The subtype is registered in `messages.md` next to the base
type.

**Effect on the unit-test formula (Step 8.1).** A subtype constructor is counted by the same
formula `1 happy + Σ antecedent branches`. No extra coverage is needed — on the contrary, the
line for the guard function (which would be counted separately) disappears.

#### Head-module pipe pseudocode

The slice head module must read like a "synopsis of the slice's work" — the whole sequence of
steps visible at a glance.

**The slice head module's form — a linear execution pipe.** Five to ten steps, each step a
separate module from the tree, data flowing through `Result<T, Error>` (or the language
equivalent: `(T, error)` in Go, `Mono<Result<T>>` in Kotlin/Reactor, the `?` operator in Rust).
No nested conditionals or loops in the pipe itself.

In the slice card the planner always records the **pipe pseudocode**, e.g.:

```
processRegistration(req: Request) -> Result<RegistrationResponse, Error>:
    | NewRegistrationCommand(req)        -> RegistrationCommand
    | persistChallenge(cmd, store)       -> ChallengeID
    | buildResponse(cmd, challengeID)    -> RegistrationResponse
```

This pseudocode is the slice card's main artifact: the implementer writes the head-module body
directly from it.

#### The head module — an orchestrator pipe, not unit-tested

The head module is **simple as a pipe**: each step calls exactly one child module and passes
the result to the next. No logic of its own — only a linear sequence of calls. That's why its
pseudocode reads in a minute.

**I/O errors propagate through the pipe untransformed.** If `persistChallenge` returned
`ErrDBLocked` — the pipe breaks, the error rises to the ingress adapter, which maps it to HTTP
503. The head module doesn't "parse" I/O errors — it only propagates them. Parsing error codes
belongs to the ingress adapter and is described in the card as a mapping `ErrXxx → HTTP status`.

**For a CLI/batch tool** the "response format" is a machine report + a return code. They are
formed by the **shared egress** (one point for all slices: mapping `ErrXxx → error.code`,
writing the report, computing the return code), not by each slice's head. The head returns a
domain result/error; egress is the HTTP ingress adapter's equivalent, but unified, because the
tool's report is homogeneous (one schema, one set of `error.code`).

**Consequence for tests.** A unit test of the head module is an integration test (the pipe
assembles real dependencies). It is **not designed** and **not written**. The pipe's
correctness is proven by a component scenario through the slice's real input. I/O error branches
are covered by failure scenarios (`db_locked`, `db_disk_full`, etc.) — not unit tests.

**Consequence for Deps.** The head module's `Deps` has no fields needed only for test
substitution (`Rand io.Reader`, `Persist func(...)`, `Now func() time.Time` — unless this is a
`clock.Clock` injection for deterministic time). A `Deps` field needed only to plug a stub into
a test is a signal of an attempt to unit-test the head. Don't introduce such a field. Hardcode
the real dependency inside the function.

#### C4 — levels of conceptual design (mandatory)

The module tree designed above is the **C3 level** of the C4 model. Record C4 in Mermaid
(`C4Context`/`C4Container`/`C4Component`, renders on GitHub) by level:

| Level | What | Where |
|---|---|---|
| **C1** System Context | system ↔ actors ↔ external systems | platform landing (concept repo, `platform-landing`) |
| **C2** Container | deployable units + libraries (honest reuse) | component design package (`c4.md`) |
| **C3** Component | **this slice's module tree** (nodes = modules) | component design package (`c4.md`) |
| **C4** "how it works" | system **Cockburn use case** (see Step 8, traceability) | `c4.md` / `architecture.md` |

Drawing the diagrams and the use case themselves is done by the `documentation` skill
(Pass B3/B4) — design does **not** write docs past the skill (see Step 12, conformance-gate).
C2+C3 are mandatory in the component repo; C1 — on the landing.
