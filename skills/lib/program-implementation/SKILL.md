---
name: program-implementation
description: Implementing a program ticket by ticket via Trunk Based Development. Use when a design package `.agent/planner/design/<slug>/` exists with an operator-approved handoff checklist, and slices are to be implemented one at a time (one ticket = one slice = one branch = one PR). Do NOT use if the package is incomplete, the checklist is not operator-approved, or a spec contradiction is found — stop and report. Tier-agnostic (weak to strong tiers): explicit MUST / MUST NOT / STOP gates, decision tables and checklists carry the essence without bloat — the optimum, not the minimum.
version: "1.0"
---

# program-implementation — implement a program ticket by ticket (TBD)

The implementer's skill. **In:** the design package `.agent/planner/design/<slug>/` from
the planner. **Out:** the program merged into main, slice by slice.

> Roles are work modes, not model switches — what matters is the artifact handoff (an approved
> design package). Method: TBD, **one ticket = one module/slice = one branch = one PR**.

## Scope

**DO:** implement exactly what the ticket says; run the TBD cycle per ticket; stop and
report on an incomplete spec or a contradiction.
**DON'T (MUST NOT):** change module contracts without the operator; implement several
slices in one branch; make unrelated "drive-by" improvements; make architecture decisions
— on a fork in the road, you **MUST** stop and ask; raise the scaffold's toolchain version
casually — keep what the scaffold set. Only a dependency that *requires* a newer toolchain
justifies a bump, and then you bump **every manifest and the container base as ONE front**
(no split version) and re-run the infra/toolchain check — never a partial or silent bump;
a skew fails the DoD gate (`validate-toolchain-consistency`).

## Steps of one ticket

| Step | Does | Out |
|---|---|---|
| 0 | Verify package handoff (once per package) | approval line confirmed `[x]` |
| 1 | Pull main, create branch | `feat/slice-<name>` off fresh main |
| 2 | Read the slice spec | contracts, call graph, Gherkin-mapping understood |
| 3 | Implement by formula (bottom-up) | modules + unit tests, slice scenarios green |
| 4 | Run local CI (4 steps) | gofmt/vet/unit/component green |
| 5 | Tick the ticket in `backlog.md` | DoD items `[x]` |
| 6 | Write the devlog | ticket block added |
| 7 | Pre-push gate: grep self-check + summary | discipline clean, await "push" |
| 8 | Commit, push, open PR, notify | PR open, URL in chat |
| 9 | Await merge, pull main, next ticket | ticket closed, main green |

### Step 0. Verify handoff (once per package, at start)

Before the first ticket, open `.agent/planner/design/<slug>/backlog.md` **in main**, find
`## Handoff checklist`. Every item must be `[x]`, including the **last line**:

```
- [x] Operator approves the package — @<github-handle>, <YYYY-MM-DD>
```

This line is the **only** deterministic sign the package is accepted (merging the design
PR = operator approval; see `program-design` Step 12). Without `[x]` on it — or if it's
missing — you **MUST NOT** start, even if every other item is `[x]`.

- No checklist → package not ready → stop, report.
- `[ ]` on the approval line → design PR not merged / line not filled → stop, report.
- `[ ]` on any other item → planner left it open deliberately; check the slice card's
  "Design decisions" for the rationale; if none → stop, report.
- All `[x]` with handle + date → proceed to Step 1.

### Step 1. Pull main and create a branch

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/slice-<name>
```

Rule: a new branch is **always** off fresh main — never off yesterday's branch.

### Step 2. Read the slice spec
> **Ticket-by-ticket (`@hughes`/`@scaffolder`): read ONLY the ticket + its `inputs:` (durable design → `docs/design/slice-<name>/`), not the whole package below** — the `.agent/planner/design/<slug>/` files in Steps 0/2/6 are the planner's own whole-slice/TBD-pass working set, which a single-ticket harness pass skips.

- `slices/<n>-<name>.md` — module tree, contracts, and the **`## Gherkin-mapping`** table
  (each Gherkin Then-step → call-graph node);
- `messages.md` — data structures;
- `contracts-graph.md` — **call graph + contract consistency** (the source of truth on
  what passes to what; if a module card and the graph disagree, the graph wins — it
  passed the planner's check);
- `component-tests/features/*.feature` — the slice's executable spec;
- `AGENTS.md`, `CLAUDE.md` — repo conventions.

You **MUST stop and report** on any contradiction, gap, or requirement that breaks the
discipline — never implement "somehow". Triggers: a module too big for a one-phrase "what it does"; two
I/O in one module; a logic module without antecedent/consequent; contracts disagreeing
with `contracts-graph.md`; **a module with 2+ data args** (violates the planner's
single-argument rule — `Input (data):` listing entities joined by "and"/","). Each → back
to the planner's Step 3/9. Don't patch code to fit the graph ad hoc — fix the spec, then
continue.

### Step 3. Implement by formula — functional core, imperative shell (bottom-up: leaves → root)

1. **Messages:** `Request` (public fields, no rules) and domain structs (`Command`,
   `Entity`) with **unexported fields**.
2. **Domain constructors** `NewT(raw) -> (T, error)` — check the antecedent; invalid data →
   error, struct not built. This is **valid-by-construction** — unexported fields + a single
   factory make illegal states unrepresentable, so this is the slice's **only** validation point.
3. **Logic modules** — pure functions over already-validated structs.
4. **I/O modules** — one per external operation (DB read/write, broker publish, REST call).
   Each is an **autonomous object encapsulating its dependency**; the head knows only its
   methods, not the dependency:

   | Integration | Object | Dependency (hidden inside) |
   |---|---|---|
   | Database | `Store` | `*sql.DB` |
   | External HTTP API | `Client` | `*http.Client` + baseURL |
   | Message broker | `Publisher` / `Consumer` | broker connection |

   ```go
   type Store struct{ db *sql.DB }
   func NewStore(db *sql.DB) Store { return Store{db: db} }
   func (s Store) Save(msg DomainMessage) error { ... }

   type Deps struct { Store Store; Clock clock.Clock }   // the object, not its dependency
   func NewDeps(db *sql.DB) Deps { return Deps{Store: NewStore(db)} }   // dependency hidden here
   ```

   Violation sign: a raw `*sql.DB`/`*http.Client` in `head.go` or `Deps` → fix before
   commit. **Empty-pipe rule:** an I/O method takes a domain message → calls the external
   system → returns result or error; no data branching, the only mapping is external code →
   domain error (`SQLITE_BUSY → ErrDBLocked`).
5. **Head module** — orchestrator: calls the command constructor, then the pipe of logic
   and I/O modules.
6. **Ingress adapter** — parsing only (external input → `Request`), no business validation;
   form (HTTP/Broker/gRPC/CLI) from the slice card.
7. **Wire the slice to its entry point** in the app infrastructure module (route / topic /
   gRPC handler / CLI command). One per program — not the slice head.

**What gets unit tests:** only constructors and logic modules (steps 2–3), by the formula
`1 happy + Σ antecedent branches`. The head, ingress adapter and I/O modules **MUST NOT** be
unit-tested — they're glue/pipes, proven by component scenarios through the real input. A
unit test against in-memory SQLite is a small integration test, not a unit. **No mocks
(MUST NOT):** unit tests use only real objects (pure functions, domain structs); if a test needs an
external dependency, it's a component test.

**Green map — the `## Gherkin-mapping` table.** Written by the planner (Step 8.3), it ties
each Then-step to the node that turns it green. Use it as deterministic feedback —
"implemented X → scenario Y must go green" — with no guessing:

1. constructor / logic module done → run the scenarios in its rows (none → it's unit-only);
2. I/O Success-branch wired into the head → run the happy scenarios listing it;
3. I/O Failure-branch + adapter mapping → run the failure scenario for that error class;
4. by the end of Step 3, **every table row is closed and all the slice's component
   scenarios are green**.

If a component scenario won't go green while unit tests pass and the table says the node is
done — **the problem is the spec, not the code** (slice contract vs OpenAPI/AsyncAPI, a
path missed in `contracts-graph.md`, or a row pointing at a non-existent node) → stop,
report, planner revisits Step 8.3/9. If a unit test is red due to a bug in the test itself,
fix the test.

### Step 4. Run local CI

Four steps mirroring `.github/workflows/ci.yml`, all mandatory **before** reporting —
skipping any means the PR's CI fails:

```bash
unformatted=$(gofmt -l .); [ -n "$unformatted" ] && echo "$unformatted" && exit 1   # 1. format
go vet ./...                                                                          # 2. static
go test -cover ./...                                                                  # 3. unit + coverage report
./component-tests/scripts/run-tests.sh healthy                                        # 4. component
node harness/validate-constructors.mjs                                                # 5. valid-by-construction
```

**Green before review:** gofmt empty, vet clean, unit all green. Component: **prior accepted**
slices stay green; the current slice's `@wip` scenarios go green only when the slice is fully
assembled — mid-slice they legitimately stay red and **keep the `@wip` tag**. The implementer
**MUST NOT** remove `@wip` — that is the **fixer's slice-acceptance** (build→unit→component,
pipeline §6). A red scenario in a prior accepted slice → stop.

**Business-logic coverage gate.** Each domain constructor + pure logic function MUST carry its design
formula's unit-test count (`1 happy + Σ branches`), all green — that is 100% branch coverage of the
business logic **by construction**. `go test -cover` reports it; head/adapter/I/O have no unit tests and
legitimately dilute the package %, so gate on the **formula-count match**, not a raw %.

**Valid by construction (gate).** `node harness/validate-constructors.mjs` MUST pass on every
domain-constructor ticket: each domain value-object (a module-tree constructor/subtype node) has
**unexported fields** + a single `NewX` factory with a validating guard, and no naked `T{...}` bypasses
it (`program-design` step-03 · [`reference/valid-by-construction.md`](reference/valid-by-construction.md)).
Not done until green.

- Unit red: bug in the module → fix the code (not the contract); a genuinely wrong test → fix it,
  but **MUST NOT** weaken/skip/delete a case or relabel a real module failure as a "test bug" to go
  green — after the fix the branch/equivalence class is still covered; contract contradicts callers
  → stop, report (Step 2).
- **Anti-gaming (units).** You **MUST NOT** `t.Skip`, comment out assertions, or drop the unit-test
  count below the design formula to go green. A red unit is a real signal — fix the module, not the test.
- Component red on the current slice: modules done but the slice won't assemble → check head
  + adapter; scenario expects undescribed behavior → stop, planner revisits Step 9.
- **Component-set sanity (formula).** The slice's `.feature` set MUST be `1 happy + Σ distinguishable
  adapter branches` (== #adapter `error.code`s). Fewer failure scenarios than the adapter has branches
  → an uncovered branch in the plan → stop, planner revisits (Step 9); "all green" over a missing
  scenario is a false pass.

### Step 5. Tick the ticket in backlog.md

Update the checklist **per confirmed item, not one batch at the end** — backlog is the only
source of truth on status.

```diff
- [ ] failure-mode component tests green
+ [x] failure-mode component tests green
```

### Step 6. Write the devlog

`.agent/planner/design/<slug>/devlog.md` — one block per ticket, in close order, added
**after** local CI is green and **before** preparing the commit (so it lands in the same
commit). For humans, not CI; 5–15 lines.

```
## S<n> — <input id> (<YYYY-MM-DD>)

**Что сделано:** one or two phrases.
**Решения по ходу:** local decisions worth knowing in a year (skip if none).
**Что застряло:** if you stopped on a mismatch and the planner fixed the graph (skip if none).
**Тесты:** units <n>, coverage <%>. Component scenarios: <names>, all green.
```

### Step 7. Pre-push gate: discipline self-check + operator summary

Last sanity gate before pushing. Run four grep self-checks, prepare the commit message, post
a short summary in chat, await "push". Goal: catch discipline violations and commit-message
typos **before** they go public (push triggers CI; undoing a pushed message is a force-push).
**Don't dump the full diff** — it's in the PR; the terminal gets only the summary.

#### 7.1. Grep self-check — each **MUST** return empty (non-empty = violation = fix first)

```bash
# 1. Head knows no I/O deps — if you see sql/http/amqp/kafka, move it into the I/O object.
grep -rn "database/sql\|net/http\|\"io\"\|amqp\|kafka" internal/*/head.go

# 2. Tests don't call the head — its correctness is proven by a component scenario, not a
#    unit. A Process*/Handle* call in *_test.go → delete the whole test block.
grep -rn "^func Test" internal/*/*_test.go | grep -iE "Process|Handle|Head|Orchestrat"

# 3. No test doubles (stubs/fakes/mocks). Only exception: testClock (time injection).
grep -rn "^type.*struct{}" internal/*/*_test.go | grep -iv "testclock\|testClock"

# 4. Deps has no fields for test substitution — each field is one real dependency.
grep -n "func(" internal/*/register.go
```

**Trap:** a head test against real in-memory SQLite still breaks the rule — the head is never
unit-tested; its path is covered by the component scenario, not a unit.

#### 7.2. Commit message — atomic, Conventional Commits (AGENTS.md §12)

```
feat(slice-<name>): implement <input id>

- ingress adapter <name>
- modules <constructors, logic, I/O>
- unit tests by formula, 100% coverage
- component test: happy + <failure modes> green
- backlog.md updated, devlog.md appended

Closes S<n>
```

`<input id>` matches the ticket title, e.g. `HTTP POST /v1/registrations`,
`Broker registrations.created`, `gRPC RegistrationService.Create`.

#### 7.3. Summary to operator + await "push" (no full diff)

```
Slice ready to push.

Files: <key changed/created files>
Local CI: gofmt clean · vet clean · units <n> green · component <n> scenarios green · discipline (grep 1-4) clean
Commit message:
<block from 7.2>

Awaiting "push" / changes.
```

- "push"/"ok"/explicit yes → Step 8.
- Comments (grep, message, file list) → fix, repeat 7.1–7.3.
- Silence / a question → answer, don't push.

### Step 8. Commit, push, open PR, notify

After "push" approval — an atomic sequence, no further stops:

```bash
git commit -m "..."                    # message from 7.2
git push -u origin feat/slice-<name>
gh pr create --base main --fill
```

PR body: ticket id, what's done (ticked DoD), spec path, tests (units + coverage, component
scenarios), TBD checklist (branch off fresh main, local CI green, backlog + devlog updated).
After `gh pr create` returns the URL, post a short notification (not a question — merge is
the operator's right):

> PR #<n> open: <url>
> **Done:** <1-2 phrases>. **Key files:** <slice card, head, tests>.

**STOP. The agent MUST NOT merge the PR itself.** `gh pr merge` runs only on an explicit
operator command ("merge"/"влей"). "push", "ok", green CI are **not** grounds to merge.

### Step 9. Await merge, pull main, next ticket

The operator merges via GitHub `Merge` (both required: operator clicked merge **and** CI
green). Fixes go as commits to the **same branch**, never a new one or main:

- CI red → repair in the same branch;
- operator left comments → fix in the same branch (back to Step 3+ where relevant), push,
  update PR; operator reviews again.

After merge:

```bash
git checkout main
git pull --ff-only origin main
```

The ticket is **closed** when main's CI is green post-merge. Back to Step 1 for the next ticket (a `backlog.md` ticket whose deps are done → new branch off fresh main).

## Definition of Done (whole package)

- All `backlog.md` tickets `[x]`; main green.
- Business logic 100% unit-covered: every domain constructor + pure logic function has its formula's unit tests, all green (head/adapter/I/O not unit-covered — by design).
- All Gherkin component scenarios green.
- `.agent/planner/design/<slug>/devlog.md` filled per ticket.
- **Slice-acceptance is the fixer's:** each slice's component suite green and `@wip` removed — not a per-ticket implementer act.
