---
name: md-formatting
description: Deterministic self-check and formatting procedure for Markdown documents. Use after writing or editing `.md` files to verify formatting before commit (blank lines around block elements, code-fence language tags, valid links/anchors). Tier-agnostic, written for reliability on weaker models: stepwise checks, grep/Python snippets, checklists, STOP rules.
version: "1.0"
---

# md-formatting — Markdown self-check before commit

**In:** one or more `.md` files. **Out:** files that render correctly in MkDocs /
Material for MkDocs — every heading, list, table, and code block displays right.

The spine of the rules is one invariant: **block elements (headings, lists, tables,
code fences) MUST be surrounded by blank lines.** The rest is language tags, valid
links, and valid anchors.

## Step 0 — preconditions (STOP)

You **MUST** stop and not format if:
- the file is not UTF-8 → convert first;
- the file holds binary data → report to the operator;
- the file does not exist → check the path.

## Step 1 — blank line after headings

A blank line **MUST** follow every `##` / `###` heading **and** every bold heading
`**Text:**` used before a list. This applies to **any** `**Text:**` line acting as a
heading — there is no fixed allow-list.

```bash
# Heading (## / ###) with a non-empty next line → violation
grep -nE '^#{2,3} .+' file.md | while IFS=: read -r n _; do
  [ -n "$(sed -n "$((n+1))p" file.md)" ] && echo "L$n: heading not followed by blank line"
done
```

```python
# Fix: ensure exactly one blank line after ## / ### headings
import re
s = open('file.md', encoding='utf-8').read()
s = re.sub(r'^(#{2,3} .+)\n(?!\n)', r'\1\n\n', s, flags=re.M)
open('file.md', 'w', encoding='utf-8').write(s)
```

## Step 2 — blank line around lists

A list (bulleted or numbered) **MUST** have a blank line **before** its first item and
**after** its last. It **MUST NOT** butt against a heading, paragraph, or another block.

````markdown
✅                          ❌
## Section                  ## Section
                            1. One
1. One                      2. Two
2. Two                      Text after.

Text after.
````

## Step 3 — blank line around tables + aligned separator

A table **MUST** have a blank line before and after, and its separator row **MUST**
have one dash group per column (`---` / `:--` / `:-:` / `--:`).

````markdown
✅                              ❌
## Table                        ## Table
                                | A | B |
| Left | Right |                |---|---|
|:-----|------:|                | x | y |
| x    | y     |                Text after.

Text after.
````

## Step 4 — valid links and anchors

- Relative links to `.md` files **MUST** point to an existing file.
- In-file anchors (`#heading`) **MUST** match a real heading (lowercase, spaces→`-`).

```bash
# Relative .md links that don't resolve
grep -oE '\]\(([^)]+\.md)\)' file.md | sed -E 's/^\]\(|\)$//g' | while read -r u; do
  case "$u" in http*) continue;; esac
  [ -f "$(dirname file.md)/$u" ] || echo "broken link: $u"
done
```

## Step 5 — code fences

- A fenced code block **MUST** have a blank line before and after.
- Every fence **MUST** declare a language (` ```bash `, ` ```python `, …).

````markdown
✅                      ❌
Text before.            Text before.
                        ```
```python               def hello(): ...
def hello(): ...        ```
```                     Text after.

Text after.
````

## Step 6 — final checklist (before commit)

- [ ] blank line after every `##` / `###` and every `**Text:**` heading
- [ ] every list has a blank line before and after
- [ ] every table has a blank line before/after and a separator with the right column count
- [ ] every relative `.md` link resolves; every in-file anchor matches a heading
- [ ] every code fence has blank lines around it and a language tag
- [ ] file is UTF-8, no trailing whitespace, ends with exactly one newline

## STOP rules

You **MUST** stop and report to the operator when:
- the file exceeds ~1000 lines and needs manual review;
- more than 20 formatting errors are found in one file;
- a link targets a missing file in another repository;
- a table has more than ~10 columns (likely needs refactoring).

You **MUST NOT** silently auto-fix beyond these formatting rules (no content edits).

## Automation (optional)

```bash
# pre-commit: check staged .md only
for f in $(git diff --cached --name-only --diff-filter=ACM | grep '\.md$'); do
  grep -nE '^#{2,3} .+' "$f" | while IFS=: read -r n _; do
    [ -n "$(sed -n "$((n+1))p" "$f")" ] && { echo "❌ $f:L$n heading without blank line"; exit 1; }
  done
done
```

CI: run the same check (or `mkdocs build`, which fails on broken links/anchors) in
`.github/workflows/ci.yml`.

## Example (before → after)

````markdown
## Section            →    ## Section
- One                 
- Two                      - One
### Sub                    - Two
Text.
**See also:**              ### Sub
- [Link](file.md)
                           Text.

                           **See also:**

                           - [Link](file.md)
````

## Quality metrics

| Metric | Target | Tolerable |
|---|---|---|
| Heading errors | 0 | ≤ 2 |
| List errors | 0 | ≤ 2 |
| Broken links | 0 | 0 |
| Check time per file | < 1 s | < 5 s |
