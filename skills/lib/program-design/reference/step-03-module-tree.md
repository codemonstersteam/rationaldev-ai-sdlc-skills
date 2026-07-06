<!-- program-design · step 03 detail. Opened via the Step-index in ../SKILL.md. -->

### Step 3. For each slice, design its module tree

**In:** the slice table (Step 2) + the frozen contract.
**Out:** each slice's module tree + head-pipe pseudocode → `docs/design/<slice>/module-tree.md` (shown at Gate #1).

#### A slice is a module (with a contract)

One `Request` in → one `Result<Response, Error>` out — **one input, one output**. Its contract = the
frozen API card (antecedent: a valid `Request`; consequent: a `Response`, or an `Error` mapped at the
edge). A slice **contains a tree of sub-modules**, designed top-down.
→ *Why:* one-in/one-out makes the slice a black box that composes and tests cleanly; a second input = a second slice.

#### Input → ingress → head

The external input is **one structure**; its wire form is set by the program type:
CLI → command/flags · HTTP → JSON body/query · queue → JSON message.

- **Single `Request` (HARD, lesson D1).** 1 slice = 1 external input = exactly one `Request`; a
  flag/option is a `Request` **field**, never a side-injection; a branch on a field is **logic (a unit)**,
  not a component scenario. → *Why:* an option honored on one path and lost on another is defect D1.
- **Ingress adapter** — the slice's edge: parse the external input → typed `Request` (one out); on the
  way back, map the pipe's `Error` → response format. **Parsing/mapping only, no logic.**
- **Head** (`Process<Slice>`) — the orchestrator: `Request` in → `Result<Response, Error>` out. A
  **linear ROP pipe** of one-call steps. No logic of its own.
→ *Why:* the wire form changes (CLI/HTTP/queue), the head doesn't — the `Request` isolates the slice from transport.

#### The tree the slice contains — subordinates

Each subordinate is **one module = one function = one input, one output** (a single phrase: «validate an
entry», «sort the catalogue»):
- **constructors** (validation): `NewT(raw) -> (T, error)` — invalid → not built, error returned;
- **pure logic** over validated structs;
- the **I/O module** (`Store`/`Client`/`Publisher`) — an **autonomous object that encapsulates its
  dependency** (the head sees only its methods, never a raw `*sql.DB`/`*http.Client`); a **pipe** moving
  bytes process↔external (DB/broker/API), **no business logic**. → *Why:* a swappable seam, and the domain
  never touches transport (full I/O design: Step 6).

- **One data argument (HARD).** A node takes exactly one data entity; 2+ ⇒ unite them in a domain struct
  via a new constructor node. → *Why:* leaking fields (`f(id, handle, ttl, db)`) hide the domain entity.
- **Invariant = subtype, not guard.** An invariant over a valid struct → a subtype constructor
  (`NewFreshEntity`), not a `-> ()` guard. → *Why:* a guard leaves the type unchanged (easy to skip); a
  subtype makes "unchecked" fail to compile.
- **Two things in one module = composite — split it.** → *Why:* one phrase per module keeps the tree
  readable and each ticket small.

#### Head-pipe pseudocode (the slice card's main artifact)

A linear 5–10-step pipe, `Result<T, Error>` flowing, each step one child. No branches, no loops.

```
processRegistration(req: Request) -> Result<RegistrationResponse, Error>:
    | NewRegistrationCommand(req)     -> RegistrationCommand
    | persistChallenge(cmd, store)    -> ChallengeID
    | buildResponse(cmd, challengeID) -> RegistrationResponse
```
→ The implementer writes the head body straight from this.

#### Errors — ROP short-circuit

A failing step **short-circuits the pipe — remaining steps are skipped**; the error rises
**untransformed**; **only the ingress adapter** maps `ErrXxx → response` (HTTP status / `error.code`).
The head never parses or branches on an error.
→ *Why:* mapping in one place (the edge) keeps the pipe pure and the error table auditable.

#### Testing — decided here (Step 8 counts it)

- **Unit tests = constructors + pure logic**, by the formula `N = 1 (happy) + Σ (antecedent branches)`.
  Every boundary / equivalence class is a unit.
- **Head, I/O module, ingress adapter are NOT unit-tested.** → *Why:* the head is a pipe of
  already-tested parts (a unit over it = an integration test); the I/O module is a byte-pipe with no logic
  — nothing to unit, and a test against a `:memory:` DB is a small **integration** test, not a unit; the
  adapter only parses/maps. Their correctness is proven by **component scenarios** through the slice's
  real input; I/O error branches → failure scenarios.

#### Composition = wiring (not a module with a contract)

`cmd/<app>/main` + `register.go` **wire** each slice-module to its entry point (route/queue/CLI). This is
**wiring, not a contract-bearing module** — the contract lives in the slice.

#### File layout (slice-aligned, ALWAYS)

One self-contained package `internal/<slug>/`; tree nodes map one-to-one:

| File | Node |
|---|---|
| `head.go` | head `Process<Slice>(req, deps) -> Result<…, Error>` |
| `adapter.go` | ingress adapter (parse + error→response) |
| `logic.go` | domain constructors + pure functions |
| `io.go` | the slice's I/O module (Store/Client), when it has I/O |
| `domain.go` | slice types |
| `errors.go` | slice sentinel errors |
| `register.go` | `Deps` + wiring to the entry point |

**Forbidden:** layer-keyed roots (`internal/{io,httpapi,logic}`) — they leak the slice boundary.
Shared by ≥2 slices → `internal/shared/`, lazily.

#### C4

The module tree is the **C3** level; record it (+ head-pipe) in `module-tree.md`. C4 diagrams → `c4`
skill; use case → `cockburn-use-case`. Not re-authored here.
