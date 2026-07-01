---
name: db-io
description: Designing an I/O object (Store) over a database — transactions, isolation, migrations, and the distinguishable failure branches (locked / disk-full / timeout / unavailable / constraint) that become the component-test failure scenarios. Use when a slice reads/writes a DB (io: db). The Store is a pure pipe (no transformations, not unit-tested); the schema + migrations are its contract. Do NOT use for sync HTTP (http-io), queues (queue-io), or module logic (program-design). Tier-agnostic: decision tables, adapter-branch list, checklist, STOP.
version: "1.0"
status: "stable"
---

# db-io — discipline for a database I/O object (Store)

Applies to any I/O object hiding a database (`io: db`): a `Store` encapsulating `*sql.DB`/pool.
The DB has no external machine spec (OpenAPI/AsyncAPI) — its **contract is the schema + versioned
migrations**, and its consumer-visible failures go in the README failure-mode map. This skill
designs the object and its failure surface.

> **Core lesson:** data defects (lost writes, dirty reads, silent constraint bypass, unbounded
> queries) are closed in **design** — transaction boundary and isolation decided before code — not
> in coding.

## The Store is a pure pipe (no transformations, not unit-tested)

The Store only **carries data**: take the domain command/query → run the SQL → return typed rows or
a mapped error. **No transformations, no data branching** (the only allowed branch is DB error →
domain error, e.g. `SQLITE_BUSY → ErrDBLocked`). Reshaping/validating/computing over the data is a
**logic module upstream**, not the Store.

**Therefore the Store is NOT unit-tested** (a test against `:memory:` is a small integration test,
not a unit). Unit-test the **logic module that builds the command** — its unit tests assert the
exact payload (the contract) that enters the Store — and the pure **row → domain** mapping. We
**expect the Store to persist/fetch that payload unchanged.** Success/failure is proven by component
scenarios. See `program-design` Step 6 and Step 8.2 (no I/O rows in the unit table).

## Transactions & isolation — design parameters, not defaults

Decide **in the slice design card, before code**, and record:

| Parameter | Question | Default unless justified |
|-----------|----------|--------------------------|
| **Tx boundary** | which writes must be atomic together? | **one business operation = one transaction** |
| **Isolation** | what anomalies are unacceptable (dirty/non-repeatable/phantom)? | DB default (often Read Committed); raise only with reason |
| **Read vs write** | is this a read Store or a write Store? | **one mode per Store method** (Step 6) |
| **Timeout** | max query/tx duration? | explicit statement/context timeout — **never unbounded** |
| **Idempotency** | are writes safe to retry? | upsert / unique key so a retried write is a no-op |

**Migrations are the contract.** Schema changes ship as **versioned, forward-only** migrations run
at startup (as the template's placeholder does). A code/schema mismatch = STOP, not a runtime guess.

## Distinguishable adapter branches (→ component scenarios)

The failure surface the component-test formula counts (`1 + Σ adapter branches`). Two modes collapse
into one branch only if HTTP status + client action + operator action all match.

| Branch | Nature | Domain sentinel (example) | Client / operator action |
|--------|--------|---------------------------|--------------------------|
| lock contention | transient | `ErrDBLocked` (→ 503 + `Retry-After`) | client retries |
| disk full | resource | `ErrDiskFull` (→ 507) | operator alert |
| query timeout | transient | `ErrDBTimeout` (→ 504/503) | retry with backoff |
| unavailable (network DB) | transient | `ErrDBUnavailable` (→ 503) | retry; operator alert |
| constraint violation (UNIQUE/FK) | domain | `ErrAlreadyExists` / `ErrConflict` (→ 409) | client fixes input |

Each distinguishable branch = one component failure scenario, named verbatim from the failure-mode
map / use-case Extension. **Reproducibility rule (from `component-tests`):** only branches you can
reproduce in a test enter the spec — e.g. `db_unavailable` is synthetic for embedded SQLite (added
when the DB is networked), so an embedded-SQLite slice specs `locked + disk_full`, not `unavailable`.

## Store object shape

Autonomous object in `internal/io` hiding `*sql.DB`/pool; each method is a **pipe**:

- `Load(key) -> (T, error)` / `Save(cmd) -> error` — one operation, one mode; map DB error →
  sentinel; a write with no useful output returns `error` only (`program-design` Step 5).
- Transaction spanning several writes: the Store exposes **one method that runs the whole tx**
  (`func (s *Store) DoOp(cmd) error`), not `Begin/Commit` leaking to the head — the head sees one
  atomic call, not tx plumbing.

The head's `Deps` holds `Store`, **not** `*sql.DB` (`program-design` Step 6). Credentials/DSN from
env by config name, fail-fast before I/O; connection pool + statement timeout set explicitly.

## Contract & stub

- **Contract:** the schema + versioned migrations — **designed by `db-schema`** (KISS tables, no
  logic in the DB, code-first migrations); consumer-visible failures in the README failure-mode map
  (there is no OpenAPI/AsyncAPI for the DB itself).
- **Stub in Docker Compose:** a **real DB** as a Compose service (or the embedded engine in the SUT),
  not an in-code mock (`component-tests`). Drive failure modes via profiles — e.g. the template's
  `disk-full` overlay (tmpfs) for `db_disk_full`, contention for `db_locked`.

## From design to tests

- **Unit** — the Store is **not** unit-tested. Unit-test the pure logic around it: the
  command/query builder, the **row → domain** mapping, and the **DB-code → sentinel** mapping (a
  pure function).
- **Component** — one scenario per distinguishable adapter branch (table) + the happy path; assert
  atomicity (on a failed tx, no partial write is visible) as its own scenario when the slice writes.

## STOP rules

Stop and ask the operator, don't guess:
- Transaction boundary / isolation / timeout **not decided** before code → STOP, decide first.
- A multi-write operation with **no transaction** (partial-write risk) → STOP.
- An **unbounded** query/tx (no timeout, no limit) → STOP.
- A failure mode won't fit transient / resource / domain → STOP, no "generic DB error".
- Code and schema disagree / migration missing → STOP, fix the migration first.

## Checklist — design (before I/O code) → implementation

- [ ] tx boundary = one business operation; multi-write ops are atomic (one Store method runs the tx)
- [ ] isolation level chosen (or DB default justified); anomalies considered
- [ ] every query/tx has an explicit **timeout**; no unbounded scans (LIMIT / index)
- [ ] writes idempotent (upsert / unique key) where retried
- [ ] migrations versioned, forward-only, run at startup; code matches schema
- [ ] adapter branches enumerated (table) → each is a component scenario; `1 + Σ` matches
- [ ] Store is a pure pipe; `Deps` holds `Store`, not `*sql.DB`
- [ ] DB error → domain sentinel (transient / resource / domain), not generic
- [ ] DSN/credentials from env (config name), fail-fast; pool + statement timeout set
- [ ] component tests: happy + each reproducible branch + **atomicity (no partial write)**; DB as a Compose service / profile

## Foundations

ACID transactions, isolation levels & anomalies, forward-only migrations, connection-pool &
statement timeouts, idempotent upserts. Pairs with `program-design` Step 6 (I/O isolation, pure
pipe), `component-tests` (`1 + Σ adapter branches`, reproducibility rule), `http-io` / `queue-io`
(siblings for other I/O types).
