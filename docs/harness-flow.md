# Граф работы харнеса rationaldev (SemVer-вертикали, плоская диспетчеризация)

`izi` (дирижёр, тир **large**) — **чисто механический роутер**: делегирует каждый кусок отдельным
субагентом **напрямую (depth 1)**, читает однострочные статусы, держит гейты. Суждение живёт в
субагентах: планирование/проектирование — **Wirth**, ревью плана — **Mills**, реализация —
**Hughes**, фикс — **Linger**, приёмка — **Fagan**, git — **Torvalds**, закрытие прогона —
**Rochkind**, канарейка — **Michtom**. Никакой вложенности subagent→subagent.

Вертикаль выбирается **весом** (SemVer), который определил `@wirth-triage`; `izi` не классифицирует.

```mermaid
flowchart TD
  OP([Оператор · BRD / TASK.md]):::h --> IZI

  IZI["izi · Witt · тир large<br/>механический роутер (ноль интеллекта)<br/>депт-1 делегирование, статусы, гейты"]:::l

  IZI --> GILB["@gilb (Gilb) · Шаг 0 фронт-дор<br/>сырое требование → измеримый brd.md"]:::l
  GILB --> TRI["@wirth-triage (Wirth) · Шаг 1<br/>ВЕС по SemVer 2.0.0 → .agent/planner/mode"]:::l

  TRI -->|route=chore| CHO
  TRI -->|route=greenfield| GF
  TRI -->|route=patch / minor / major| SEM
  TRI -->|level=epic / unclear| STOPX["STOP → оператор<br/>эпик не реализован"]:::stop

  subgraph GF["ВЕРТИКАЛЬ greenfield → 1.0.0"]
    direction TB
    INT["@wirth-intake → frd.md"]:::l
    SL["@wirth-slicer → slices.md"]:::l
    UC["@wirth-usecase → use-case.md (ЦИКЛ по срезам)"]:::l
    API["@wirth-apidesigner → контракт · ОДИН РАЗ · FREEZE"]:::l
    MD["@wirth-moduledesigner → module-tree/contracts(io:)/c4"]:::l
    RM["@dijkstra → README.md (скилл documentation)"]:::l
    INT --> SL --> UC --> API --> MD --> RM
  end

  subgraph SEM["ВЕРТИКАЛИ patch · minor · major (репо построен харнесом)"]
    direction TB
    CI2["@change-intake → change-delta.md<br/>discriminating old ≠ new · design=needed|skip"]:::l
    API2["@wirth-apidesigner (minor/major)<br/>эволюция контракта"]:::l
    ADD["validate-contract-diff --require-additive<br/>minor: breaking ⇒ STOP → ре-триаж major"]:::val
    MD2["@wirth-moduledesigner (design=needed)<br/>только зарябившие модули"]:::l
    CI2 --> API2 --> ADD --> MD2
  end

  subgraph CHO["ВЕРТИКАЛЬ chore (no-bump)"]
    direction TB
    CP["@wirth-planner → docs/chores/NNN-slug/CHORE-PLAN.md<br/>файлы · команда верификации · откат"]:::l
  end

  GF --> TK["@wirth-ticketer → тикеты (тип: scaffold|component|module)"]:::l
  SEM --> TK
  TK --> PLN["@wirth-planner → PLAN.md (индекс путей, не проектирует)"]:::l
  PLN --> MILLS["@mills (Mills) · ОДИН проход<br/>консистентность плана · покрытие по весу<br/>OK | blocker | escalate"]:::l
  MILLS -->|blocker| LFIX["@linger (Linger) · локальный фикс"]:::s
  LFIX -->|перезапуск| MILLS
  MILLS -->|OK / escalate| G1
  CHO --> G1

  G1{{"Gate #1 — акцепт плана · токен GATE1 APPROVE"}}:::gate
  OP -. GATE1 APPROVE .-> G1
  G1 --> BR["@git-hand mode=start (Torvalds)<br/>ветка type/slug от свежего транка"]:::s

  subgraph IMPL["РЕАЛИЗАЦИЯ · роутинг по МЕТКЕ тикета · K=2"]
    direction TB
    SC["scaffold → @scaffolder (только greenfield)"]:::s
    CT["component → @wirth-tester · RED по контракту"]:::l
    MOD["module → @hughes (greenfield)<br/>@hughes-rework (patch|minor|major)"]:::s
    SC --> CT --> MOD
  end

  BR --> IMPL
  IMPL --> LAY["validate-layout · пока-йоке раскладки"]:::val
  LAY --> FAG["@fagan (Fagan) · DoD + инвариант веса<br/>снимает @wip, сам не чинит"]:::l
  FAG -->|FAIL| LFIX2["@linger · фикс (K=2)"]:::s
  LFIX2 --> FAG
  FAG -->|accepted| TERM["@git-hand mode=terminal<br/>commit → push → PR (вес в заголовке) → CI"]:::s
  TERM -->|ci=red| LFIX2
  TERM -->|ci=green| G2

  G2{{"Gate #2 — мерж · токен GATE2 APPROVE"}}:::gate
  OP -. GATE2 APPROVE + мерж .-> G2
  G2 --> LED["@ledger (Rochkind) · close-run.mjs<br/>пруф мерджа → тег (semver-bump) → LEDGER.md → вайп .agent/"]:::s
  LED -->|no-bump| DONE([прогон закрыт]):::done
  LED -->|тег| MICH["@michtom (Michtom)<br/>канарейка 1→5→25→100% + 4 сигнала"]:::s
  MICH --> G3{{"Gate #3 — приёмка после канарейки"}}:::gate
  OP -. приёмка .-> G3
  G3 --> DONE

  GR{{"rational-guardrail (--hard)<br/>блок имплементаторов без Gate #1 · блок работы на транке<br/>маркеры гейтов ставит только хук · decisions.log"}}:::guard
  GR -. форсит .-> G1
  GR -. форсит .-> G2

  classDef l fill:#e3f0ff,stroke:#2b6cb0,color:#12345a;
  classDef s fill:#eafbea,stroke:#2f855a,color:#153f22;
  classDef h fill:#fff4d6,stroke:#b7791f,color:#5a3d00;
  classDef gate fill:#ffe3e3,stroke:#c53030,color:#5a1212;
  classDef guard fill:#efe3ff,stroke:#6b46c1,color:#2d1a5a;
  classDef val fill:#f0f0f0,stroke:#555,color:#222;
  classDef stop fill:#ffcccc,stroke:#c53030,color:#5a1212;
  classDef done fill:#d5e8d4,stroke:#2f855a,color:#153f22;
```

## Легенда
- 🟦 **тир large** — суждение: `izi`-роутинг, `@gilb`, `@wirth-*`, `@mills`, `@fagan`, `@linger`.
- 🟩 **тир small** — исполнение: `@hughes`/`@hughes-rework`, `@scaffolder`, `@git-hand`, `@ledger`, `@michtom`.
- ⬜ **детерминированные валидаторы** — `validate-contract-diff`, `validate-layout`, `validate-dod`,
  `close-run.mjs`/`semver-bump.mjs`: механика вместо суждения.
- 🟨 **Оператор** — только три human-gate, токены `GATE1 APPROVE` / `GATE2 APPROVE`.
- 🟪 **rational-guardrail** (`--hard`) — блок имплементаторов до Gate #1, блок работы на транке,
  маркеры гейтов ставит только хук.

## Ключевые принципы
- **Одна ось — вес.** Пять вертикалей (`greenfield|patch|minor|major|chore`); маршрутов «чужой репо»,
  разведки и conform-режима нет: харнес ведёт репозитории, которые построил сам.
- **Плоскость (depth 1):** izi делегирует субагентов напрямую; они дальше НЕ делегируют.
- **Один контракт на сервис:** `@wirth-apidesigner` вызывается ОДИН раз (не per-slice) → freeze до дизайна модулей.
- **Ревью верхнеуровневое:** Mills судит план как целое; под SemVer-вертикалью дополнительно проверяет
  непустой discriminating-сценарий и покрытие, соответствующее весу.
- **Локальный фикс:** Linger чинит там, где проблема, — не переписывает план; имплементатор своё красное не чинит.
- **Без луупов:** `steps`-cap + счётчик попыток (K=2) + жёсткий блок guardrail → escalate оператору.
- **Прогон закрывается явно:** тег/no-bump → запись в `docs/changes/LEDGER.md` → вайп `.agent/`;
  иначе `gate1.approved` прошлой задачи пропустит следующую.
