# Backlog ticket templates (reference for program-design, Step 11)

Copy the needed template into `backlog.md` and replace each placeholder `<…>` with specifics per
the substitution table from Step 11.

## Ticket template

```
### TICKET S<n> — slice <name>: <input identifier>

**Spec:**
- `.agent/planner/design/<slug>/slices/<n>-<name>.md` (main document)
- `.agent/planner/design/<slug>/messages.md` — <list the slice-specific types>
- `.agent/planner/design/<slug>/contracts-graph.md` — section "S<n> <name>"
- `.agent/planner/design/<slug>/infrastructure.md` — <what exactly: wiring, migrations, Deps>

**Dependencies:** <S<m>, S<k> — what exactly is imported (types, I/O objects)>.
No new external Go dependencies. (or: new go.mod entries: <list>)

**Branch:** `feat/slice-<name>`

**Definition of Done:**

- [ ] `<file>/domain.go`: <concrete types and constructors from Step 3>
- [ ] `<file>/logic.go`: <concrete functions from Step 3> — pure functions, no I/O
- [ ] `<file>/adapter.go`: `ParseArgs(args,stderr) -> (Request, error)` — <what it parses>
- [ ] `<file>/head.go`: `Process<Slice>(req, Deps) -> (Result, error)` — linear pipe
- [ ] `<file>/register.go`: `Deps{<fields>}` + `NewDeps(<arguments>) -> Deps`
- [ ] `<entry point>`: <function name> added, `"<name>"` removed from the stubs
- [ ] unit tests by formula written and green — `go test ./...` passes.
  **<N> new tests**: <Module1>(<n1>) + <Module2>(<n2>) + … (from the Step 8.1 table).
  <Head, adapter, I/O objects> are not unit-covered.
- [ ] component tests green — `<run command>`.
  scenarios listed: "<name1>", "<name2>", … (from Step 8.3). `@wip` stays — it is removed by the
  **fixer** at slice-acceptance (not by this ticket).
  Previously green scenarios S1–S<m> still pass.
- [ ] `backlog.md` updated per each confirmed item
- [ ] `.agent/planner/design/<slug>/devlog.md` appended with an S<n> block
- [ ] PR created, description filled by the skill's Step 8 template
- [ ] PR merged into main, CI on main green

**Source links:**
- Implementation skill: `program-implementation`
- Call graph: `.agent/planner/design/<slug>/contracts-graph.md` — section "S<n>"
- Gherkin-mapping: section `## Gherkin-mapping` in `slices/<n>-<name>.md`
- <applied principles — "head without branching", "subtype, not guard", etc.>
```

## Example of a finished ticket

A sample — a ticket for slice `<name>` (a CLI subcommand, deterministic logic without I/O; the
same layout holds for an HTTP endpoint):

```
### TICKET S<n> — slice <name>: CLI `<name> <arg>`

**Spec:**
- `.agent/planner/design/<slug>/slices/<n>-<name>.md` (main document)
- `.agent/planner/design/<slug>/messages.md` — `<Type1>`, `<Type2>`, `<Type3>`
- `.agent/planner/design/<slug>/contracts-graph.md` — section "S<n> <name>"
- `.agent/planner/design/<slug>/infrastructure.md` — wiring in `internal/cli/cli.go`

**Dependencies:** S<m> (in main) — `<Store>`, `<Sink>`, `New<Target>`,
`NewConfig`, `buildReport`, egress. No new external Go dependencies.

**Branch:** `feat/slice-<name>`

**Definition of Done:**

- [ ] `internal/slice/<name>/domain.go`: types `<Type1>{...}`,
  `<Type2>{...}`, `<Type3>`; constructor `New<Type3>(input) -> <Type3>`
- [ ] `internal/slice/<name>/logic.go`: `<extractX>`, `<verifyX>`,
  `<buildX>`, `<mergeX>`, `New<Report>`, `<buildOutcome>`
  — pure functions, no I/O
- [ ] `internal/io/<dep>.go`: interface `<Dep>` + `<NoopDep>{}` (null-object)
- [ ] `internal/slice/<name>/adapter.go`: `ParseArgs(args,stderr) -> (Request, error)`
- [ ] `internal/slice/<name>/head.go`: `Process<Slice>(req, Deps) -> (Report, error)`
- [ ] `internal/slice/<name>/register.go`: `Deps{Store, <Dep>}` + `NewDeps`
- [ ] `internal/cli/cli.go`: `run<Slice>Cmd` added, `"<name>"` removed from `subcommandsTodo`
- [ ] unit tests by formula written and green — `go test ./...` passes.
  **<N> new tests**: `<extractX>`(2) + `New<Type3>`(1) + `<verifyX>`(3)
  + `<buildX>`(3) + `<mergeX>`(3) + `New<Report>`(1)
  + `<buildOutcome>`(2). Head, adapter, `<NoopDep>` are not unit-covered.
- [ ] component tests green — `./component-tests/scripts/run-tests.sh healthy`.
  scenarios: "<happy → pass>", "<bad input → fail>", "<no resource → not_found>".
  `@wip` stays — removed by the **fixer** at slice-acceptance, not this ticket.
  Previously green scenarios S1–S<m> still pass.
- [ ] `backlog.md` updated per each confirmed item
- [ ] `.agent/planner/design/<slug>/devlog.md` appended with an S<n> block
- [ ] PR created, description filled by the skill's Step 8 template
- [ ] PR merged into main, CI on main green

**Source links:**
- Implementation skill: `program-implementation`
- Call graph: `.agent/planner/design/<slug>/contracts-graph.md` — section "S<n> <name>"
- Gherkin-mapping: section `## Gherkin-mapping` in `slices/<n>-<name>.md`
- Head-without-branching principle: `slices/<n>-<name>.md` §"Head without branching"
```

## Note on the example

Note on the example: the head `Process<Slice>` is a **linear pipe without branching**. An
optional mode (e.g. an extra tier behind a flag) is resolved **at the edge** — the router picks
the dependency-interface implementation (real client / null-object) rather than branching the
head; merging the results of the main and optional logic is a separate constructor node
(`New<Report>`). This keeps the head readable and testable by one component scenario.
