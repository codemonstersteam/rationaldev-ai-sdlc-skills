# db-schema · reference — commit checklist + foundations (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **перед коммитом миграции** (tick-верификация)
> и для фона. Сами правила (KISS / no-logic-in-DB / migrations / STOP) — в `SKILL.md`.

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
