---
name: git-conventions
description: Deterministic Git procedure following Trunk-Based Development. Use for all branch, commit and PR operations. Tier-agnostic, written for reliability on weaker tiers: step-by-step commands, message validation, STOP rules.
version: "1.0"
---

# git-conventions — Trunk-Based Development

> Template convention (placeholders: `DOS-XXX` = Jira key, `example.com` = org domain).
> The taught convention's literal values — commit format and the **Russian** commit text
> rule — are policy, kept as-is; only the instructions around them are in English.

## Branch model

One long-lived branch: **`trunk`**. Rules (all **MUST**):
- every feature branch is cut from `trunk` (**MUST NOT** branch off another feature branch);
- feature branch lives **≤ 2 days**, bugfix branch **≤ 1 day**;
- one PR **≤ 600 lines** of code and ideally **≤ 10 files**;
- **one task = one PR**; **MUST NOT** commit directly to `trunk`.

Naming: `feature/DOS-XXX` (new functionality) · `bugfix/DOS-XXX` (bug fix).

## Branch commands

```bash
# create
git checkout trunk && git pull origin trunk && git checkout -b feature/DOS-XXX
# daily refresh / prepare to merge (always rebase onto fresh trunk)
git checkout trunk && git pull origin trunk
git checkout feature/DOS-XXX && git rebase trunk
git push origin feature/DOS-XXX        # only when preparing the merge
```

## Commit message

**Format:** `DOS-XXX (type): сообщение`. Rules (**MUST**): Jira key present; text in
**Russian** (project policy); **≤ 50 chars**; lowercase; no trailing period. Breaking
change → `!` after type: `DOS-XXX (refactor)!: изменён формат ответа API`.

| type | when | type | when |
|---|---|---|---|
| `feat` | new functionality | `refactor` | refactoring |
| `fix` | bug fix | `test` | tests added/changed |
| `docs` | documentation | `chore` | build/deps |
| `style` | formatting (no logic) | | |

Examples (text stays Russian — the rule; ≤50 counts the WHOLE line): `DOS-01 (feat): двухфакторная
аутентификация` · `DOS-01 (docs): актуализирована документация` · `DOS-01 (feat)!:
добавлено новое обязательное поле`.

**Anti-examples (MUST NOT):** `fix bug` (no key) · `DOS-01: fix` (no type) ·
`DOS-01 (FEAT): Fix bug` (uppercase type, English) · `DOS-01 (feat): Добавил новую фичу
для пользователей` (> 50 chars).

## commit-msg hook

Save as `.git/hooks/commit-msg`, `chmod +x` it. Enforces `TASK-number (code): text` and a
Russian text body; rejects an author email outside the org domain.

```bash
#!/bin/sh
msg=$(cat "$1"); errors=""
allowed="feat fix docs style refactor test chore"
TASK=$(echo "$msg" | sed -nE 's/^([A-Z]{2,20})-.*/\1/p')
number=$(echo "$msg" | sed -nE 's/^[A-Z]{2,20}-([0-9]+).*/\1/p')
code=$(echo "$msg" | sed -nE 's/^[A-Z]{2,20}-[0-9]+ *\(([a-z]+)\):.*/\1/p')
text=$(echo "$msg" | sed -nE 's/^[A-Z]{2,20}-[0-9]+ *\([a-z]+\): *(.*)/\1/p')

echo "$TASK" | grep -qE '^[A-Z]{2,20}$' || errors="${errors}TASK: 2-20 uppercase latin letters\n"
echo "$number" | grep -qE '^[0-9]+$' && [ "$number" -ge 1 ] && [ "$number" -le 999999 ] \
  || errors="${errors}number: 1..999999\n"
echo "$allowed" | grep -qw "$code" || errors="${errors}code: one of [$allowed]\n"
{ [ -n "$text" ] && [ ${#text} -ge 2 ]; } || errors="${errors}text: >= 2 chars\n"
echo "$text" | grep -qP '[а-яА-ЯёЁ]' || errors="${errors}text: must be in Russian\n"

if [ -n "$errors" ]; then
  printf "Commit rejected — expected: TASK-number (code): text\n"; printf "$errors"; exit 1
fi
email=$(git config user.email)
echo "$email" | grep -qE "example.com" || { echo "Commit rejected — email $email not in example.com"; exit 1; }
exit 0
```

## Code review

SLA: respond ≤ 2h in working hours; review ≤ 1h per PR; **≥ 1 approve MUST** precede merge.
PR quality: code meets standards · tests cover new functionality · docs updated if needed ·
no conflicts with `trunk` · CI green.

## Before push — local CI (all four MUST be green)

```bash
unformatted=$(gofmt -l .); [ -n "$unformatted" ] && echo "$unformatted" && exit 1   # format
go vet ./...                                                                          # static
go test ./...                                                                         # unit
./component-tests/scripts/run-tests.sh healthy                                        # component
```

## STOP rules

You **MUST** stop and ask the operator when:
- a branch lives > 2 days → ask what blocks the merge;
- a PR exceeds 600 lines → split into atomic PRs;
- no Jira key → don't commit, create the task first;
- the commit message fails validation → fix before push;
- CI is red → don't push, fix locally;
- a breaking API change → update the contract (OpenAPI/AsyncAPI) before committing.

## Workflow

1. Take a task from `backlog.md`. 2. `git checkout trunk && git pull`. 3. Branch
`feature/DOS-XXX`. 4. Implement (TDD per module). 5. Local CI — all green. 6. Commit
`DOS-XXX (type): сообщение`. 7. `git push -u origin feature/DOS-XXX`. 8. Open PR (template
below). 9. Await ≥ 1 approve. 10. Merge (operator). 11. `git checkout trunk && git pull`.
12. Delete the branch. 13. Update `backlog.md` (move to Done).

## PR template

```markdown
## Задача
DOS-XXX — описание

## Что сделано
- [ ] пункт 1
- [ ] тесты зелёные

## Спецификация
docs/design/XXX/...

## Тесты
- юниты: X, покрытие Y%
- компонентные: Z сценариев зелёные

## Чек-лист TBD
- [x] ветка от свежего trunk
- [x] локальный CI зелёный
- [x] backlog.md обновлён
```

## Pre-commit checklist

- [ ] branch cut from `trunk` (not another feature branch); Jira key in the branch name
- [ ] commit message `DOS-XXX (type): текст` — Russian, ≤ 50 chars, no period
- [ ] local CI (4 steps) green; `gofmt -l` empty
- [ ] PR ≤ 600 lines, ≤ 10 files
- [ ] index clean: no build artifacts / binaries / secrets / large blobs (`git ls-files`); such files belong in `.gitignore`, not the commit

## Metrics

| Metric | Target |
|---|---|
| repos with a `trunk` branch | 100% |
| commits direct to `trunk` | 0% |
| merged PRs without ≥ 1 approve | 0% |
| `feature` branches > 2 days | ≤ 10% |
| PRs > 600 lines | ≤ 20% |
