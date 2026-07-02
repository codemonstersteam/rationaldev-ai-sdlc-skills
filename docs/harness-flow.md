# Граф работы харнеса rationaldev

Полный поток: оркестрация → планирование (диспетчер + этап-роли) → Gate #1 → per-ticket реализация
→ фиксер → релиз. Модели: **GLM 5.2** (large — планирование/дизайн/ревью), **Qwen3.6-27b**
(small/medium — реализация/health). Каждая этап-роль грузит **только свой скилл** (малый контекст).

```mermaid
flowchart TD
  OP([Оператор · Witt]):::human

  ORCH["orchestrator · GLM<br/>роутер: уровень задачи, гейты<br/>skills: memory, platform-landing"]:::glm

  subgraph PLAN["ПЛАНИРОВАНИЕ — planner-диспетчер · GLM (skills: memory)"]
    direction TB
    INT["intake · GLM<br/>requirements-intake → frd.md"]:::glm
    SL["slicer · GLM<br/>vertical-slices → slices.md"]:::glm
    subgraph PS["на КАЖДЫЙ слайс"]
      direction TB
      UC["usecase · GLM<br/>cockburn-use-case → use-case.md"]:::glm
      API["apidesigner · GLM<br/>openapi/asyncapi-spec → контракт (frozen)"]:::glm
      MD["moduledesigner · GLM<br/>program-design+c4+db-schema<br/>→ дерево/контракты(io:)/c4 + NFR"]:::glm
    end
    TK["ticketer · GLM<br/>implementation-ticket-writer → tickets/NN<br/>порядок: scaffold → компонентные(RED) → модули"]:::glm
  end

  PR["plan-reviewer · GLM<br/>conformance-review (не тот, кто писал)"]:::glm

  subgraph IMPL["РЕАЛИЗАЦИЯ — per-ticket (N имплементеров)"]
    direction TB
    IM["implementer · Qwen ×N<br/>1 тикет = 1 субагент = только его скиллы<br/>тесты → модуль → зелёное"]:::qwen
  end

  FX["fixer · GLM(ревью)/Qwen(фикс)<br/>build→unit→component; slice-acceptance: @wip↓"]:::glm
  RH["release-health · Qwen<br/>канарейка 1→5→25→100% + 4 сигнала"]:::qwen

  GR{{"rational-guardrail (--hard)<br/>Gate#1 жёстко · decisions.log · маркер только оператор"}}:::guard

  OP -->|BRD / TASK.md| ORCH
  ORCH -->|task, depth≤2| INT
  INT --> SL --> UC --> API --> MD --> TK --> PR
  PR --> G1{{"Gate #1 — акцепт плана"}}:::gate
  OP -. пишет «акцепт» .-> G1
  GR -. форсит .-> G1
  G1 -->|разблок @implementer| IM
  IM --> FX
  FX --> G2{{"Gate #2 — мерж"}}:::gate
  OP -. мерж .-> G2
  G2 --> RH --> G3{{"Gate #3 — приёмка после канарейки"}}:::gate
  OP -. приёмка .-> G3

  classDef glm fill:#e3f0ff,stroke:#2b6cb0,color:#12345a;
  classDef qwen fill:#eafbea,stroke:#2f855a,color:#153f22;
  classDef human fill:#fff4d6,stroke:#b7791f,color:#5a3d00;
  classDef gate fill:#ffe3e3,stroke:#c53030,color:#5a1212;
  classDef guard fill:#efe3ff,stroke:#6b46c1,color:#2d1a5a;
```

## Легенда
- 🔵 **GLM 5.2** — планирование/дизайн/ревью (large, temp 0.7 из `models.config.json`).
- 🟢 **Qwen3.6-27b** — реализация тикетов, канареечный health (small/medium).
- 🟡 **Оператор (Witt)** — только 3 human-gate; «акцепт» на Gate #1 (touch-free через плагин).
- 🔴 **Gate #1/2/3** — акцепт плана / мерж / приёмка после канарейки.
- 🟣 **rational-guardrail** — плагин `--hard`: жёстко блокирует implementer без Gate #1, пишет `decisions.log`, маркер `gate1.approved` ставит только оператор (агент не может).

## Ключевые принципы на графе
- **Диспетчеризация:** planner не делает этапы сам — делегирует их субагентам (свежий малый контекст, свой скилл).
- **io-router:** тип I/O модуля (`io: none|http|llm|queue|db`) → набор скиллов в тикет; имплементер не выбирает.
- **Contract-first порядок:** спеки → компонентные тесты (RED) → модули (юнит-тесты) → GREEN.
- **Скелет из шаблона:** `service-scaffold` клонирует `template-go-api` (не жжём токены на boilerplate).
```
