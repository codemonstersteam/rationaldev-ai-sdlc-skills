---
name: cli-io
description: Designing the CLI ingress adapter of a slice — the driving adapter of a hexagon. Parse flags + positional args + config into ONE flat Request DTO, hand it to the pure core (head), map the core's Result to an exit code (0/1/2/3) and stdout (JSON report) / stderr (logs). Keep it small — ≤5 flags, no elephant; domain params MAY be flags. Use when a slice's external input is a command-line invocation (Go + cobra), not HTTP/queue. Do NOT put domain logic in the command. Scaffold — template-go-cli. Keywords - CLI, cobra, ingress, driving adapter, DTO, exit code, one-shot.
version: "1.0"
---

# cli-io — the CLI ingress adapter

## What you are — the frame you reason from
A CLI is a **driving (primary) adapter** in a hexagon (Cockburn, *Ports & Adapters*): the same rank as an
HTTP handler or a queue consumer — a *door*, not the room. It carries **no domain logic**. Its whole job:
take whatever arrives — flags, positional args, a config file — and **assemble it into ONE flat Request
DTO** (Fowler), then hand that DTO to the **head** (the composition root). The core is **source-agnostic**:
the identical DTO could have arrived over HTTP or off a queue — the core never learns it was launched from
a shell. That symmetry is why a CLI needs **no special contract design**: same DTO, same pure core, same
promise — only the door changes.

Two things the core returns become the CLI's observable surface:
- the **`Result`** (Railway-Oriented, Wlaschin) → an **exit code** — *the exit code is to a CLI what the
  HTTP status is to a service*: the machine-readable serialization of the outcome;
- the **report** → **stdout** (data), while logs/diagnostics go to **stderr** (Unix philosophy, McIlroy:
  text streams are the universal interface; never mix data and diagnostics on one channel).

Your discipline is **minimalism**: a CLI does one thing, takes ≤5 flags, stays pipeable. Don't build an elephant.

## The invariant — collect any input into ONE DTO
Whatever the shape of the input, the adapter produces a single flat `Input`/`Request` DTO and passes it to
the head. **Domain parameters MAY be flags** — there is no "transport vs domain" dogma; the only rules are
*assemble into one DTO* and *stay small*:
- **few parameters** → a handful of flags (domain ones included) → build the DTO;
- **many parameters** → `--config <path>` + a few override flags → load + build the DTO (e.g. pinout's
  `contract-tests.yaml`).

The failure to avoid is **two sources of truth** (half in flags, half in config, never reconciled) — fold
them into the one DTO.

## Exit code — the CLI's status line
The head's `Result` maps to a small canonical grid (aligned with `sysexits(3)`, not bloated) — these are
exactly the branches of the Railway pipe:

| code | branch | meaning |
|---|---|---|
| `0` | Ok | core succeeded; report on stdout |
| `1` | domain failure | input valid, but the domain said "no" (check failed, contract broken) |
| `2` | config / usage | bad invocation, unreadable/invalid config, malformed input DTO |
| `3` | environment / spec | external failure not caused by the input (missing resource, network, internal error) |

`1` = "the domain honestly said no", `2` = "you gave bad input", `3` = "something around it broke". The
mapping `Result → code` is therefore mechanical and directly testable.

## Streams — stdout is data, stderr is diagnostics
- **stdout** — only the machine report (the `Result` as JSON). Nothing else: it is piped to `jq` / read by
  the harness; one stray line breaks the consumer's parser.
- **stderr** — logs, progress, human diagnostics. Colour/animation only here, only on a TTY.
- The report is structured by default (the input is machine-facing), not only under `--json`.

## Config & flags — precedence and the minimum
- precedence (high → low): **flags > env > config-file**. The config file is the main DTO carrier; env and
  flags override pointwise. (No user/system-wide config layers — bloat for a one-shot tool.)
- required minimum: **`--help`/`-h`** (and a bare invocation → short usage) and **`--version`**. Nothing
  more "built-in" is owed.

## Component tests — static binary, one-shot
- one **static binary** (`CGO_ENABLED=0`), no runtime deps → drops into a container as-is;
- **one-shot** invocation (`tool run fixture.yaml`), stateless between runs (12-factor: config is data);
- the binary runs in a container against **config fixtures**, asserting `(exit code, stdout JSON)` — black
  box. Coverage is the same **`1 + Σ distinguishable adapter branches`** as any component suite (see
  `component-tests`): one happy path + one scenario per **external-integration failure** (`≡ error.code`);
  input-value boundaries stay **unit**-level. A CLI merely *observes* the outcome as an exit code + stdout
  instead of an HTTP status + body — the exit code is the serialization, not the counting unit;
- the CLI's own **outbound** deps (HTTP fetch, DB, …) get a **real-protocol stub** in compose (a stub,
  not a mock, per `component-tests`); only the *core* is never mocked.

## Anti-patterns — not part of the door
- **interactive prompts / TTY input** — break one-shot & automation; all input lives in flags/config.
- **business logic in the command / cobra handler** — dissolves the adapter boundary, makes the core
  untestable without the CLI. The command only parses and maps.
- **a heavy flag DSL** (dozens of domain flags, nested subcommands) — domain lives in the DTO/config; a
  fat flag surface forks the truth.
- **TUI / spinners / "smart" coloured output on stdout** — pollutes the machine channel.
- **plugin systems / dynamic loading** — contradict "one static binary, one-shot"; extend the core, not the runtime.
- **"smart" env-reading defaults** (auto-`$CWD`, config lookup up the tree) — non-deterministic for tests;
  the config path is given explicitly.

## The shape — fill it, don't invent it
Scaffold: **`template-go-cli`** (`github.com/codemonstersteam/template-go-cli`) — a fillable skeleton whose
ingress already wires the door; tickets fill the domain. The shape you complete:

```
cmd/app/main.go        cobra root + `run <config>` (+ --json / --verbose / --version)
internal/<slug>/
  cli/      Parse(args) → Input DTO        ← the door: flags/args → one flat DTO
  head.go   Head(deps, in) Result          ← ROP pipe: NewX(in) → logic → build report
  errors.go Result.Code → exit code        ← the status-line mapping (grid above)
```
`main` does three things only: **parse → `Head(...)` → `os.Exit(code)` + write report**.

## STOP
- domain logic creeping into `cli/` or the cobra handler → STOP, move it behind the head.
- more than ~5 flags, or a second source of truth → STOP, fold into the DTO / config.
- stdout carrying anything but the report → STOP.
