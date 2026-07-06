# Bench task — service `services-by-platform` (Go)

> This is the **frozen prompt** handed identically to every agent/harness under test.
> Do not edit between runs — edits invalidate the comparison.

## Business requirement

Build a small HTTP service in **Go** that exposes one REST endpoint and serves a catalogue of
repositories grouped by platform.

- **Endpoint:** `GET /services?sort=platform,service`
- **Data store:** `services.yaml` is the service's **data store — a file-based stand-in for a
  DBMS**. Access it through a dedicated **storage/repository module** (so it could be swapped
  for a real database later, without touching the handler/domain). Its location is part of the
  service **configuration** (like a DB DSN/connection string), default `services.yaml`.
- **Response:** a JSON **array**, sorted by `platform` ascending, then by `service` ascending.
  Each element has exactly these fields:

  | field | type | meaning |
  |---|---|---|
  | `platform` | string | platform name |
  | `service` | string | service (repository) name |
  | `git_url` | string | link to the git repository |
  | `commits_2m` | integer | number of commits in the last 2 months |

  > `commits_2m` is a **precomputed snapshot already present in `services.yaml`** — read it and
  > serve it as-is. (No git access, no network — kept deterministic on purpose.)

- On success respond `200` with `Content-Type: application/json`.

## Actors & stakeholders
- **Primary actor:** a client (dashboard / CI / another service) that queries the catalogue, read-only, over HTTP.
- **Stakeholder:** the platform operator who maintains the `services.yaml` data store.
- **External systems / interfaces:** inbound HTTP (the one endpoint); the data store (`services.yaml`, DB stand-in). No outbound calls, no network, no auth (internal service).

## Use cases (titles — to be formalized by the implementing harness)
- **UC1 — List services by platform:** client GETs the catalogue → `200` + sorted JSON array per the contract.
- **UC2 — Data store missing / empty / malformed:** outcome per the failure-mode map (distinct `error.code` + HTTP status per case).

## Non-functional requirements
- Read-only; no auth (internal); **no PII** in data or logs.
- Small dataset (tens–hundreds of rows); concurrent reads MUST be safe.
- **Deterministic** output (stable sort); target p99 `< 50 ms` at this dataset size.
- Structured logs; the service MUST refuse to start on invalid config (fail fast).

## Glossary
- **platform** — grouping key (e.g. web / mobile / backend). **service** — a repository name.
- **commits_2m** — precomputed 2-month commit count (snapshot in the store). **data store** — `services.yaml` (DBMS stand-in).

## Assumptions / out of scope
- No write/update endpoints, no pagination, no filtering, no DB migration; a single data store.
- Sort is fixed and **informational** — the service always sorts by `platform` then `service`
  regardless of the `sort` value; it is NOT a validated input (no `400` on other values, no branch).
  `commits_2m` is served as-is (not computed).

## Input format (`services.yaml`)

```yaml
services:
  - platform: web
    service: storefront
    git_url: https://git.example.com/web/storefront
    commits_2m: 42
  # ... more entries
```

## Hard constraints (so the result is verifiable, identical for both harnesses)

- The program MUST be a **proper modular service**, **not one `main.go`**. A thin `main`
  package at the module root only wires dependencies; the logic lives in separate packages:
  a **storage/repository** module (reads the `services.yaml` data store behind an interface,
  swappable for a real DB), a **domain** module (sort/business rules), and an **HTTP handler**
  module (e.g. `internal/storage`, `internal/catalog`, `internal/httpapi`). It MUST still build
  with `go build ./...` and run as a single binary.
- **Configuration from files/env — NO hardcode.** The listen port, the `services.yaml` path,
  and every other parameter MUST come from a **config file** (e.g. `config.yaml`) and/or env
  vars (env overrides file). **No hardcoded ports, paths, or magic constants** in the code
  (explicit over implicit). `PORT` env still honored (default `8080`).
- Output field names MUST be exactly `platform`, `service`, `git_url`, `commits_2m`.
- Sort MUST be `platform` asc, then `service` asc. JSON array, not an object.

## API contract (OpenAPI) — MANDATORY

The service MUST be **contract-first**: deliver **`api-specification/openapi.yaml`** describing
`GET /services?sort=platform,service` — the response schema (array of objects with the four fields and
their types), the `200` response, and the error responses (`4xx/5xx`) with an `error.code`.
The implementation MUST conform to this contract; the component tests (below) are written
**against this OpenAPI spec**.

## Failure-mode map — MANDATORY

The `README.md` MUST contain a **`## Карта режимов отказа`** table: one row per distinguishable
failure mode (missing/empty/malformed `services.yaml`, bad config) with columns `error.code`,
HTTP status, client action, operator action. Each failure mode MUST have a matching use-case
component test.

## Component tests — Gherkin (from the OpenAPI contract), in Docker, by use case — MANDATORY

The service MUST be covered by **component tests written in Gherkin** (`.feature` scenarios,
run by **godog**), executed **in Docker, in isolation** (the test runner runs **inside a
container**; no host `go test` for component tests). They treat the running service as a
**black box over HTTP** and are organized **by use case** — one scenario per use case / outcome.
Scenarios MUST assert responses **against the OpenAPI schema** (status, `Content-Type`, body
shape and field types per `api-specification/openapi.yaml`).

> **Plain shell assertion scripts are NOT acceptable — such work is REJECTED.** Assertions
> live in `.feature` scenarios + godog step definitions, not in `curl | jq` shell checks.

Deliver at the repo root:
- **`Dockerfile`** — builds the service image.
- **`docker-compose.yml`** — service container + a **`tester`** container that runs godog
  against the service over the network.
- **`component-tests/features/*.feature`** — Gherkin scenarios, one per use case (happy path +
  each failure-mode use case).
- **`run-tests.sh`** — `docker compose -f ... up --abort-on-container-exit --exit-code-from tester`;
  exit `0` on green, tears the stack down.

Cover at minimum the **use cases**: list services by platform (happy path, sorted result) and
the failure use case (missing/empty `services.yaml`).

## Unit tests — MANDATORY

Every module (package) MUST be covered by Go **unit tests** (`*_test.go`): the YAML loader/parser,
the sort/domain logic, the HTTP handler. **`go test ./...` MUST pass.** Code without unit tests
is REJECTED.

## Documentation — MANDATORY

The service MUST ship documentation (per the `documentation` discipline). Deliver:
- **`README.md`** at the repo root: what the service does, how to build/run (`go build`, `PORT`,
  Docker), the **API** (`GET /services?sort=platform,service` — request, response schema, example), and
  how to run the tests (`run-tests.sh`, `go test`).
- A short **architecture** note (modules and their responsibilities) + the **use cases** the
  service covers and its **failure modes** — inline in `README.md` or under `docs/`.

Work without documentation is REJECTED.

## Definition of done

`bench/acceptance/check.sh <service_dir>` is green. It checks, in order:
1. **`go build ./...`** and **`go test ./...`** pass (unit tests green);
2. the service answers `GET /services?sort=platform,service` with the expected JSON (`bench/fixture/expected.json`);
3. **modular structure** — logic in packages (`internal/...`), not a single `main.go`;
4. **`api-specification/openapi.yaml`** present (contract-first);
5. **configuration from a file/env, no hardcoded port/path/constants**;
6. **Gherkin** component tests present (`component-tests/features/*.feature`, written against the OpenAPI schema); shell-only assertions are NOT accepted;
7. `Dockerfile`, `docker-compose.yml`, `run-tests.sh` present, and `run-tests.sh` exits `0`
   (the Dockerized godog component tests pass);
8. **`README.md`** present with API + run + architecture/use-cases + **`## Карта режимов отказа`**.

Work lacking the **OpenAPI contract, Gherkin component tests, unit tests, a modular
architecture, file-based config (no hardcode), or documentation is NOT accepted.**
That script is the **only** arbiter of "done".
