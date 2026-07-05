# git-workflow-steps — вынести git в отдельные workflow-шаги (роли git-less на этом этапе) 🟡

> **Решение оператора:** на данном этапе отдаём роли и воркфлоу **git-less** (имплементеры пишут только в
> рабочее дерево). Git-шаги (branch/commit/PR/merge) — **отдельные operator-owned workflow-шаги, позже**.

## Утечка (нашёл аудит имплементер-ролей/скиллов)

Класс «правило заявлено, но не сшито»: core-скилл имплементера **весь git-driven**, а роль git **запрещает**.

- **`program-implementation/SKILL.md`** — 9-шаговая спина «branch → commit → push → open PR → await merge»
  (Steps 1/7/8/9: `git checkout -b feat/slice-<name>`, `git commit`/`push`, `gh pr create`, «await merge, pull
  main», DoD «main green»). Загружается hughes'ом как **always-core** скилл.
- **`hughes.md` / `scaffolder.md`** — «You **MUST NOT** touch git. No branches, no commits, no PR — just write
  files into the working tree. Branching/commits/acceptance are decided one level up (**TBD**)».
- Мостика нет: «one level up (TBD)» так и не сведено с git-телом скилла → слабая модель следует пронумерованным
  шагам скилла и делает git → нарушение роли; валидатора «дерево git-clean после имплементера» нет.

Родственное (уже вычищено, #3 из того же аудита): `program-design/reference/ticket-template.md` нёс git-DoD
(`Branch:`, `PR created`, `PR merged`) — **убрано** (git = workflow-level, не DoD тикета).

## Что сделать (позже, отдельным вектором)

1. **Вынести git-шаги из `program-implementation`** в отдельный **operator-owned** артефакт (скилл/шаг воркфлоу
   или git-integration роль), который hughes/scaffolder **никогда не грузят**. Тело `program-implementation`
   оставить **working-tree-only** (write files → tests → green), без branch/commit/PR/merge.
2. **Явный git-workflow шаг** после приёмки слайса (Gate #2 = мерж): кто ветвит/коммитит/открывает PR/мержит —
   человек-оркестратор или выделенная роль, по TBD-процессу.
3. Согласовать с моделью гейтов: Gate #2 (мерж) — человеческий; git-механика висит на нём, не на имплементере.

## Приёмка
- `program-implementation` не содержит git-шагов; hughes/scaffolder гарантированно git-less (дерево — только запись).
- Git-механика (branch/PR/merge) — в одном явном operator-owned шаге, привязанном к Gate #2.
- Ни один имплементер-скилл/тикет не требует git-действий.

## Связи
Из аудита имплементер-ролей (та же сессия, что P0/P1). Родственно `template-agent-instrument` (шаблон=инструмент)
и модели гейтов (`docs/00_PROCESS.md`, Gate #2 = мерж). Паттерн — «правило в роли, но не в её core-скилле/шаблоне».
