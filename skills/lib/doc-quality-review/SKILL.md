---
name: doc-quality-review
description: Deterministic rubric for reviewing the quality of already-written repository documentation against the 6 core characteristics of IBM's "Developing Quality Technical Information" framework (Hargis, Carey et al.) — task orientation, accuracy, completeness, clarity, organization, retrievability — adapted to markdown docs. Built for any tier: ✓/✗ checks, an "if ✗ → action" rule, a summary verdict, and an edit plan. Apply when you need to REVIEW existing README / docs/architecture.md / other docs for quality. Do NOT use to write a doc from scratch — that is the documentation skill; the style / concreteness / visual characteristics are deliberately out of the core.
version: "1.0"
---

# Documentation Quality Review — 6-characteristic rubric

This skill scores **already-written** documentation. Input: the doc file(s) and the
document type. Output: a filled rubric (✓/✗ per check), an edit list, and a summary
verdict.

Rubric source: IBM "Developing Quality Technical Information: A Handbook for Writers
and Editors" (Hargis, Carey et al.). The **core 6 of 9** characteristics relevant to
dev docs are used; checks are reworded for a markdown repository.

> To write or rebuild a doc (not review it), use the [`documentation`](../documentation/SKILL.md)
> skill. To find where content belongs, see its "Router" section.

---

## 0. How to use

1. Identify the document type and its JTBD segment (see `documentation`, section 6).
   Segment unclear → STOP (section 8), ask the operator.
2. Go through sections 2–7 in order. In each, mark ✓ or ✗ for every check.
   ✓ = condition met literally. Any doubt = ✗ (don't stretch it).
3. Each ✗ → take the action from the "if ✗ → action" column. Record it in the edit plan.
4. At the end, fill the summary table (section 7 → result) and the verdict.
5. **MUST NOT** fix it yourself if the edit changes meaning or deletes a fact → STOP, ask.

Per-characteristic verdict scale:
- **OK** — all checks ✓.
- **Edits** — some ✗, but the doc is usable and fixable spot-by-spot.
- **Redo** — more than half the characteristic's checks are ✗.

---

## 1. What to review under which type

| Document type | Characteristics to apply |
| --- | --- |
| `README.md` | All 6 (sections 2–7) |
| `docs/architecture.md` | Task orientation, Accuracy, Completeness, Organization (2,3,4,6) |
| ADR / devlog / other | Accuracy, Clarity, Retrievability (3,5,7) |

---

## 2. Task orientation

The doc helps the user get their job done, instead of describing product features.

| Check | if ✗ → action |
| --- | --- |
| Written for a specific JTBD segment (`documentation` section 6), not "for everyone" | Identify the target segment; drop other-segment content per the router |
| Text is from the user's point of view ("to run it — do X"), not the system's | Rewrite from the reader's point of view |
| Each block has a visible practical purpose (why read it) | Add one "why" sentence or remove the block |
| Focus on real tasks (run, connect, extend), not a feature list | Reword features as tasks |
| Headings reveal the task ("Run", "Connect"), not abstractions ("General") | Rename headings to tasks |
| Instructions split into discrete steps, each step one action | Break the instruction paragraph into numbered steps |

---

## 3. Accuracy

The doc matches the code and contract, nothing stale.

| Check | if ✗ → action |
| --- | --- |
| API table and pipes match `api-specification/` (endpoints, methods) | Sync with the contract; no contract → STOP |
| Run commands actually work (copy — it runs) | Fix the command or mark a TODO in `backlog.md` |
| Facts are consistent across README, `architecture.md`, ADR (no contradictions) | Reconcile to one value; source of truth is contract/code |
| Links to related docs are correct and lead where stated | Fix the path (see section 7) |
| No mentions of removed modules/flags/endpoints | Delete the stale references |

---

## 4. Completeness

Everything the task needs is covered, and **only** that.

| Check | if ✗ → action |
| --- | --- |
| All mandatory blocks for the type are present (for README — the `documentation` passes) | Add the missing block |
| Every endpoint in the API table has a pipe description | Write the missing pipe |
| Detail is exactly what the segment needs, no over-engineering | Cut excess implementation detail |
| No content that doesn't belong in this file (concept-level, other service) | Move it out per the router (`documentation`, "Router") |
| Information is not repeated uselessly (single source of truth) | Replace the duplicate with a link to the source |

---

## 5. Clarity

Unambiguous, short, terms defined.

| Check | if ✗ → action |
| --- | --- |
| The "what it is" overview is one sentence ≤ 20 words, not a paragraph | Cut to a single sentence |
| No ambiguous pronouns/references ("this", "it" without a clear antecedent) | Replace the pronoun with a noun |
| Items are short (sentence ≤ ~25 words, list item ≤ ~12 words) | Split the long one into parts |
| Every new term is defined at first use | Add a definition or a link to the glossary |
| One term per concept across the whole doc (no synonym confusion) | Unify the terminology |
| Similar information is presented uniformly (same tables/templates) | Bring it to one format |

---

## 6. Organization

Content is in the right file, in the right order, with parts visibly fitting together.

| Check | if ✗ → action |
| --- | --- |
| Each piece is in its own file per the router (one content type = one place) | Move the piece to the right file |
| Block order follows order of use (what it is → run → deeper) | Reorder blocks into the "ladder" order |
| Context/rationale is separated from instructions (ADR apart from run steps) | Move rationale to `docs/adr/` |
| Heading hierarchy is even: a branch has a reasonable number of sub-items (not 1, not 15) | Group or promote sub-items |
| The main thing is emphasized, the secondary subordinated (not all at one level) | Rebuild heading levels |
| It is visible how the system's parts fit together (module tree / link ladder) | Add a module tree or a context ladder |

---

## 7. Retrievability

The reader quickly finds and navigates where needed; links work and are meaningful.

| Check | if ✗ → action |
| --- | --- |
| All links resolve (no broken/dangling paths to nonexistent files) | Fix the path or create the target file; otherwise remove the link |
| Link text is descriptive ("docs/architecture.md — the layout", not "here"/"click") | Rewrite the link anchor into something meaningful |
| README's first lines have a pointer to the root repository / concept doc | Add a pointer line (see `documentation`, router) |
| There is a ladder deeper (links to component-tests → architecture → adr → contributing) | Add the missing ladder links |
| Headings are navigable: each alone conveys its content (a mental table of contents) | Rename uninformative headings |
| The link's target section is easy to find on the other side (lands in the right place, not "at the top of a big file") | Sharpen the destination anchor/section |

---

## 8. STOP rules

You MUST stop and ask the operator if:

- The document's JTBD segment cannot be determined.
- An edit requires deleting or rewriting a substantive fact — ask where it should go.
- There is no `api-specification/` contract but Accuracy requires an API cross-check.
- A link is dangling but it is unclear whether the target file should appear later or the link be removed.
- The doc was written by a human and the edit is large-scale (a redo) — confirm before.

---

## 9. Review result

Fill in the summary. For each applied characteristic — a verdict from section 0.

```
Document: <path>   Segment: <JTBD segment>

| Characteristic     | ✓ / total | Verdict      |
| Task orientation   |   _ / 6   | OK/Edits/…   |
| Accuracy           |   _ / 5   |              |
| Completeness       |   _ / 5   |              |
| Clarity            |   _ / 6   |              |
| Organization       |   _ / 6   |              |
| Retrievability     |   _ / 6   |              |

Summary verdict: <usable as is / spot edits / redo>
Edit plan:
1. <file:place> — <what to do>  (from "if ✗ → action")
2. ...
```

Summary verdict:
- **Usable as is** — all characteristics OK.
- **Spot edits** — there are "Edits", no "Redo".
- **Redo** — at least one characteristic is "Redo" → return it to the `documentation` skill.
