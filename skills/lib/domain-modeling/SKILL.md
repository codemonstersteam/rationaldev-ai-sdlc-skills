---
name: domain-modeling
description: Single source of the domain-model FORMAT for the planning pipeline — CONTEXT.md (ubiquitous language), ADR (decisions), CONTEXT-MAP (multi-context). The *active* discipline of sharpening the model (challenge terms, invent edge cases, write it down the moment it crystallises); merely *reading* CONTEXT.md is a one-line habit, not this skill. Consumed by requirements-intake (pins CONTEXT.md), vertical-slices (names bounded contexts + relationships), documentation (writes ADRs) — they reference this for format, never duplicate it. Rule: slice = bounded context; knowledge co-located in docs/design/slice-<slug>/, code in internal/<slug>/, bound by one slug. Lazy — create a file only when there is something to write. Do NOT use to design module trees (that is program-design) or to write code.
version: "1.0"
status: "stable"
---

# domain-modeling.skill — one source of CONTEXT / ADR / CONTEXT-MAP format

> **Status: Ф0 skeleton** (feature [`domain-context-adr-layout`](../../../docs/features/domain-context-adr-layout.md)).
> Role-wiring (intake/slicer/documentation) lands in Ф1–Ф3; this file already carries the **format + structure**
> so the others can *reference* it — «по одной копии», без дублирования формата в трёх скиллах.

## Purpose

Domain modeling is a **cross-cutting discipline**, not a pipeline stage — no own role, no gate. Two halves:

- **Active (this skill):** *changing* the model — challenge a term, invent an edge-case scenario, write the
  glossary/decision down the moment it crystallises.
- **Passive (a one-liner any skill does):** *reading* `CONTEXT.md` for vocabulary. **Not** this skill.

This skill is the **single source of the format** (`CONTEXT-FORMAT`, `ADR-FORMAT`, `CONTEXT-MAP`). Intake,
slicer and documentation **reference** it — they must not re-describe the format (one copy, no drift).

## Slice = bounded context

One vertical slice owns one bounded context. Its **language** (`CONTEXT.md`) and **decisions** (`adr/`) are
slice-scoped knowledge — they live in the slice's **design package**, keyed by the same `<slug>` as its code.

## File structure (co-location **B** — decided)

Knowledge lives in the **design package**, not inside the code folder: `internal/<slug>/` does not exist
until scaffold (after Gate #1), while `CONTEXT.md` is born at planning (intake). Code and knowledge are two
trees bound by one `<slug>` (спайка с [`slice-aligned-code-layout`](../../../docs/features/slice-aligned-code-layout.md)).

**Single context (most tasks — stays laconic):**

```
/
├── CONTEXT.md            ← glossary (root)
└── docs/adr/             ← system-wide decisions
```

**Multi context (≥2 contexts — slice = context):**

```
/
├── CONTEXT-MAP.md              ← context list + Relationships
├── docs/adr/                   ← system-wide decisions
├── internal/<slug>/            ← CODE (doc-comment → docs/design/slice-<slug>/)
└── docs/design/slice-<slug>/   ← KNOWLEDGE (same slug)
     ├── CONTEXT.md             ← this context's glossary
     ├── adr/                   ← context-specific decisions
     └── c4.md · use-case.md · contracts.md · module-tree.md
```

**Lazy.** Create any file only when there is something to write — first resolved term → `CONTEXT.md`; first
qualifying decision → `adr/`. Which structure applies is **inferred**: `CONTEXT-MAP.md` present → multi; only
root `CONTEXT.md` → single; neither → create root `CONTEXT.md` on the first resolved term.

## The active discipline (during planning / implementation)

- **Challenge against the glossary** — a term conflicting with `CONTEXT.md` → call it out at once
  («glossary defines 'cancellation' as X, but you mean Y — which?»).
- **Sharpen fuzzy language** — propose **one** precise canonical term for a vague/overloaded word.
- **Stress-test with scenarios** — invent edge cases that force precise boundaries between concepts.
- **Cross-reference code** — a stated behavior contradicting the code → surface the contradiction.
- **Write inline, not batched** — resolve a term → update `CONTEXT.md` right there.

`CONTEXT.md` is a **glossary and nothing else** — no implementation detail, no spec, no scratch pad.

## Who consumes this (wired in Ф1–Ф3 — NOT yet)

| Role | Uses | Phase |
|---|---|---|
| `requirements-intake` (wirth-intake) | pins terms in `CONTEXT.md` at planning; multi → per-slice + root `CONTEXT-MAP` | Ф1 |
| `vertical-slices` (wirth-slicer) | names each slice's bounded context + relationships in `CONTEXT-MAP` | Ф2 |
| `hughes` (via `documentation`) | writes context-specific / system-wide ADRs (three-condition rule) | Ф3 |
| `linger` (this skill **only** — lean) | writes context-specific ADRs during fixes (fix = often a hard-to-reverse trade-off) | Ф3 |

> **linger wiring is lean:** `linger` carries **only `domain-modeling`** (not the full `documentation` skill) —
> the ADR template + numbering + placement + three-condition rule are self-contained in `ADR-FORMAT`. Allowlist,
> not preload (#40): the body loads only when a fix produces a qualifying decision (rare).

## Formats (companions)

- **[CONTEXT-FORMAT](reference/CONTEXT-FORMAT.md)** — `CONTEXT.md` structure, opinionated `_Avoid_`, single-vs-multi + `CONTEXT-MAP`.
- **[ADR-FORMAT](reference/ADR-FORMAT.md)** — 1–3-sentence ADR, sequential numbering, three-condition «offer sparingly», context-specific vs system-wide.

## STOP / rules

- Do **NOT** design module trees (that is `program-design`) or write code.
- Do **NOT** duplicate the format into intake/slicer/documentation — they **reference** this skill.
- Multi-context knowledge → `docs/design/slice-<slug>/`, **never** `internal/<slug>/` (lifecycle: code folder absent at planning).
- Create files **lazily**; never a placeholder `CONTEXT.md`/`adr/` with nothing to say.
