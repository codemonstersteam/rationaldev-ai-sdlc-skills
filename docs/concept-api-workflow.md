# Концепт — детерминированный workflow разработки API-сервиса

> **Цель:** мультиагентская разработка в **детерминированном воркфлоу** — конвейер ролей от требований
> (`TASK.md`) до здоровой фичи в проде через **три Human Gate**. Каждый этап имеет проверяемый
> вход/выход; между этапами стоят **детерминированные валидаторы** (не LLM), которые ловят типовые
> провалы слабой модели до того, как ошибка уйдёт дальше.
>
> Этот документ — про **процесс разработки** (граф ролей). Архитектуру самого́ *сервиса* документирует
> C4 по уровням (C1 — на лендинге платформы, C2/C3 — в `docs/architecture.md` сервиса; см. скилл
> [`documentation`](../skills/lib/documentation/SKILL.md)). Процесс — это поток, поэтому он нарисован
> как Mermaid **flowchart** (рендерится на GitHub, проходит `validate-mermaid`).

## Вектор: где мы на осях процессов

Харнес нацелен на матрицу процессов; сейчас в **отладке** — одна ячейка (выделена):

| Ось | Значения | Сейчас |
|---|---|---|
| **Задача** | epic · фича · улучшение · баг-хотфикс · рефакторинг | **фича / модуль** |
| **Приложение** | web · mobile · cli · **go-api** | **go-api** |
| **Среды** | **CI** · **PROD** (канарейка) | **CI → PROD-канарейка** |

Остальные ячейки (web/mobile/cli, epic/hotfix/рефакторинг) — вектор, ещё не реализованы.
Граф ниже — это ячейка `задача=фича · приложение=go-api · среды=CI→PROD`.

## Граф конвейера

Легенда: 🟪 **izi** — механический роутер (без LLM-решений по содержанию, durable ticket-ledger) ·
🟦 LLM-роль (генерирует артефакт) · 🟩 детерминированный валидатор (гейт, не LLM) ·
🟧 **Human Gate** (решение человека).

```mermaid
flowchart TD
    classDef human fill:#ffe8cc,stroke:#e8590c,stroke-width:2px,color:#000
    classDef gate fill:#fff3bf,stroke:#f08c00,stroke-width:2px,color:#000
    classDef llm fill:#e7f5ff,stroke:#1971c2,color:#000
    classDef det fill:#ebfbee,stroke:#2f9e44,color:#000
    classDef router fill:#f3f0ff,stroke:#7048e8,color:#000

    TASK["TASK.md — требования (Discovery: человек + ИИ)"]:::human

    subgraph PLAN["ПЛАНИРОВАНИЕ — Wirth-роли, izi маршрутизирует, depth-1"]
        direction TB
        IZI["izi — механический роутер + ticket-ledger"]:::router
        TRIAGE["wirth-triage — тип задачи / scope"]:::llm
        INTAKE["wirth-intake — FRD + счёт use-case"]:::llm
        VFRD(["validate-frd + UC — псевдо-UC?"]):::det
        SLICER["wirth-slicer — вертикальные срезы"]:::llm
        VSLI(["validate-slices — #срезов ≤ #endpoints"]):::det
        USECASE["wirth-usecase — Cockburn UC на срез"]:::llm
        APIDES["wirth-apidesigner — OpenAPI, ЗАМОРОЗКА"]:::llm
        VCON(["validate-contract-frozen"]):::det
        MODDES["wirth-moduledesigner — module-tree + C4"]:::llm
        VMER(["validate-mermaid — C4 рендерится?"]):::det
        TICKET["wirth-ticketer — тикеты + DoD-закрытие"]:::llm
        VTIC(["validate-tickets — заголовки/skills"]):::det
        PLANNER["wirth-planner — PLAN.md на срез"]:::llm
        MILLS["mills — ревью плана, ПЕРЕзапускает ВСЕ валидаторы"]:::llm
    end

    GATE1{"Human Gate #1 — акцепт плана"}:::gate

    subgraph IMPL["РЕАЛИЗАЦИЯ"]
        direction TB
        SCAF["scaffolder — клон шаблона, wiring"]:::llm
        TESTER["wirth-tester — компонентные тесты RED"]:::llm
        HUGHES["hughes — модули до GREEN"]:::llm
        LINGER["linger — приёмка / CI / фиксы"]:::llm
    end

    GATE2{"Human Gate #2 — мерж"}:::gate

    subgraph REL["РЕЛИЗ"]
        direction TB
        MICHTOM["michtom — канарейка + 4 золотых сигнала"]:::llm
    end

    GATE3{"Human Gate #3 — приёмка прод-релиза"}:::gate
    DONE["Здоровая фича в проде"]:::human

    TASK --> IZI
    IZI --> TRIAGE
    TRIAGE --> INTAKE
    INTAKE --> VFRD
    VFRD --> SLICER
    SLICER --> VSLI
    VSLI --> USECASE
    USECASE --> APIDES
    APIDES --> VCON
    VCON --> MODDES
    MODDES --> VMER
    VMER --> TICKET
    TICKET --> VTIC
    VTIC --> PLANNER
    PLANNER --> MILLS
    MILLS --> GATE1
    GATE1 -->|акцепт| SCAF
    GATE1 -->|отказ| IZI
    SCAF --> TESTER
    TESTER --> HUGHES
    HUGHES --> LINGER
    LINGER -->|RED / FAIL| HUGHES
    LINGER --> GATE2
    GATE2 -->|мерж| MICHTOM
    MICHTOM -->|GREEN — расширить| GATE3
    MICHTOM -->|RED — откат| LINGER
    GATE3 --> DONE
```

## Как читать граф

- **Асимметрия генератор/критик.** Кто генерирует артефакт (план, код, выкат) — тот его не принимает.
  Ревьюер (`mills`) и приёмщик (`linger`) — отдельные роли; человек держит три гейта.
- **Детерминированные валидаторы — не LLM.** 🟩-узлы (`validate-frd/slices/mermaid/contract-frozen/tickets`)
  — чистая логика (`harness/lib/validators.mjs`), ловят классы провалов слабой модели: псевдо-use-case,
  переусложнённое дробление срезов, битый Mermaid-C4, разморозку контракта, кривые заголовки тикетов.
  Каждый стоит **сразу за своим авторским этапом** (consequent автора) и **повторно** прогоняется у `mills`
  как чек-лист перед Gate #1 — прозе «это разные входы» валидатор не верит.
- **izi — механика, а не решение.** Роутер только маршрутизирует и ведёт durable ticket-ledger
  (`docs/design/slice-<name>/…` + `.agent/planner/done.log`); он **не** принимает решений по содержанию и
  проверяет артефакты только по зашитому пути (`read`/`ls`, не `glob`). Это делает поток идемпотентным:
  упавший тикет ретраится **точечно**, готовые — пропускаются.
- **Три петли обратной связи.** `Gate #1 → отказ → izi` (переплан), `linger → RED/FAIL → hughes`
  (доводка до зелёного), `michtom → RED → linger` (откат канарейки).

## Артефакты по этапам

Планирование пишет durable пакет на срез — его и ревьюит человек на Gate #1:

```
docs/design/slice-<name>/
  use-case.md      Cockburn UC (wirth-usecase)
  module-tree.md   дерево модулей (wirth-moduledesigner)
  c4.md            C4 в Mermaid (wirth-moduledesigner) — проходит validate-mermaid
  contracts.md     срез замороженного OpenAPI (wirth-apidesigner)
  PLAN.md          план среза (wirth-planner)
  tickets/ticket-N.md   тикеты реализации (wirth-ticketer)
.agent/planner/
  frd.md           FRD (wirth-intake) · slices.md (wirth-slicer) · done.log (izi ledger)
```

## Связанные документы

- [`README.md`](../README.md) — вектор проекта, роли, быстрый старт.
- [`docs/00_PROCESS.md`](00_PROCESS.md) — полное описание процесса (роли, гейты, канареечный CD).
- [`CONCEPT.md`](../CONCEPT.md) · [`AGENTS.md`](../AGENTS.md) — фундамент и неизменяемые правила.
- [`docs/SDLC.svg`](SDLC.svg) — векторная схема CI→канарейка (тот же поток, другой ракурс).
- Скилл [`documentation`](../skills/lib/documentation/SKILL.md) — где живёт C4 **сервиса** (C1–C3), в отличие
  от этого графа **процесса**.
