---
name: db-schema
description: Design a database SCHEMA (tables) the KISS way — simple flat tables, no mandatory columns, NO logic in the DB (no triggers / stored procedures / business CHECKs / cascades), validity guaranteed by code not by the schema. Schema is code-first: versioned, forward-only migrations applied from code with Go tooling (Atlas / goose / golang-migrate — Liquibase-style, in Go). Use when a slice needs new/changed tables (io: db). Pairs with db-io (how to talk to the DB). Do NOT use to design the Store object (db-io) or module logic (program-design). Tier-agnostic: KISS rules, a "no logic in DB" list, migration checklist, STOP.
version: "0.1"
status: "draft"
---

# db-schema — KISS database schema design (code-first)

Design the **tables**. The database is a **dumb store** — validity is guaranteed by the code
(domain constructors, "module always valid"), not by the schema. The schema is simple and carries
no logic; the Store (`db-io`) is a pure pipe over it.

> **Principle:** push nothing into the database that the code already guarantees. A table is a
> bucket of columns, not a place for business rules.

## KISS rules (hard)

- **Simple flat tables.** One table per aggregate/entity. No premature normalization, no clever
  inheritance, no EAV. Prefer fewer, obvious tables.
- **No mandatory columns.** Do **not** encode required-ness in the schema (`NOT NULL` is not the
  validator). Columns are permissive; **the domain constructor already rejected invalid input**
  before the write. Exception: the **primary key / identity** column (you need a key to address a row).
- **No logic in the DB.** Forbidden: triggers, stored procedures, functions, business `CHECK`
  constraints, computed/generated columns, `ON DELETE CASCADE` and referential *logic*. Any rule
  that decides or transforms belongs in a **logic module** (`program-design`), never in SQL.
- **Simple types.** Use plain column types (text, int, timestamptz, uuid, bool, jsonb for a blob).
  No DB enums (a code concern), no custom types.
- **Surrogate key.** A stable surrogate PK (uuid/id). Referential integrity between tables is a
  **code** concern (the Store loads by id) — do not enforce it with FK logic in the DB.
- **No indexes for "maybe".** Add an index only for a query the slice actually runs (and record
  which). An unused index is cost, not safety.

## Code-first migrations (Liquibase-style, in Go)

The schema lives **in the repo as versioned migrations**, applied **from code**, not hand-run SQL.

- **Tooling:** a Go migration tool — **Atlas** (declarative schema-as-code, closest to Liquibase),
  or **goose** / **golang-migrate** (versioned up-migrations). Pick one per repo (the
  `template-go-api` sets the default).
- **Forward-only, versioned.** Each change is a new numbered migration; migrations are immutable
  once merged. Run **at service startup** (as the placeholder skeleton does) or in a dedicated
  migrate step — the same way in CI and prod.
- **Schema = contract.** The migrations are the DB contract `db-io` refers to. A code/schema
  mismatch → STOP (a missing migration is a defect, not a runtime guess).
- **Reviewable.** A migration is a small, readable diff; destructive changes (drop/rename) are called
  out for operator review (they are hard to reverse — candidate for an ADR).

## Where it sits in the pipeline

Schema design happens when a slice's design needs persistence (`io: db`), alongside `db-io`:

- `db-schema` (this) → the **tables + migrations** (the DB contract).
- `db-io` → the **Store** object (pure pipe) that reads/writes those tables.
- `program-design` → the **logic modules** that build valid commands before the Store; they own all
  validation the schema deliberately does not.

## STOP rules

Stop and ask the operator, don't guess:
- A rule is about to go into the DB (trigger / stored proc / business `CHECK` / cascade) → STOP,
  move it to a logic module.
- A `NOT NULL` / required column is proposed "to be safe" → STOP; validity is the code's job.
- A destructive migration (drop/rename column or table) → STOP, operator review (+ ADR).
- Schema changed by hand instead of a migration → STOP, write the migration.
- FK/constraint added to enforce a business rule → STOP, that's logic, not schema.

## Checklist — schema design → migration

- [ ] one flat table per entity; no premature normalization/EAV/inheritance
- [ ] no mandatory columns except the PK/identity; validity guaranteed by code
- [ ] **no logic in the DB** (no triggers/procs/business CHECK/generated cols/cascade)
- [ ] simple column types; no DB enums/custom types
- [ ] surrogate PK; referential integrity handled in code, not FK logic
- [ ] every index maps to a real query the slice runs (recorded)
- [ ] change is a **versioned forward-only migration** (Atlas/goose/golang-migrate), applied from code
- [ ] migrations run identically in CI and prod (startup or migrate step)
- [ ] destructive change flagged for operator review (+ ADR if hard to reverse)

## Foundations

KISS / YAGNI schema design; validity-in-code (domain constructors, "module always valid" —
`program-design`); code-first, forward-only migrations (Liquibase concept, realized with Go tools:
Atlas schema-as-code, goose, golang-migrate). Pairs with `db-io` (Store = pure pipe over these
tables) and `component-tests` (the schema's reproducible failures — see the `db-io` adapter branches).
