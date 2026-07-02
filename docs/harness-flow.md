# Граф работы харнеса rationaldev (v2 — плоская диспетчеризация)

`izi` (оркестратор, Qwen) — **чисто механический роутер**: делегирует каждый кусок отдельным
субагентом **напрямую (depth 1)**, читает однострочные статусы, держит гейты. Всё планирование и
проектирование тикетов — **Wirth на GLM**; реализация — **Hughes на Qwen**; ревью — **Mills**,
фикс — **Linger** (GLM); релиз-здоровье — **Michtom** (Qwen). Никакой вложенности subagent→subagent.

```mermaid
flowchart TD
  OP([Оператор]):::h -->|BRD / TASK.md| IZI

  IZI["izi · Qwen<br/>механический роутер (ноль интеллекта)<br/>делегирует куски depth-1, читает статусы, гейты"]:::q

  subgraph PLAN["ПЛАНИРОВАНИЕ · Wirth · GLM (каждый — свежий субагент)"]
    direction TB
    INT["@wirth-intake → frd.md<br/>(+ годно/STOP)"]:::g
    SL["@wirth-slicer → slices.md<br/>(возвращает список срезов)"]:::g
    UC["@wirth-usecase → use-case.md<br/>(ЦИКЛ по срезам)"]:::g
    API["@wirth-apidesigner → openapi.yaml<br/>ОДИН РАЗ · один контракт · FREEZE"]:::g
    MD["@wirth-moduledesigner → module-tree/contracts(io:)/c4<br/>(ЦИКЛ по срезам)"]:::g
    TK["@wirth-ticketer → tickets/NN<br/>ОДИН РАЗ · scaffold первый → component RED → module → infra"]:::g
    PLN["@wirth-planner → plan.md<br/>индекс путей + сводка (не проектирует)"]:::g
  end

  MILLS["@mills · GLM<br/>ОДИН проход: верхнеуровневая консистентность<br/>OK | blocker | escalate"]:::g
  LFIX["@linger · GLM<br/>локальный фикс по blocker<br/>(io → сверка контракта с вызывающим)"]:::g

  subgraph IMPL["РЕАЛИЗАЦИЯ · роутинг по МЕТКЕ тикета · step-cap K=2"]
    direction TB
    SC["scaffold → @hughes · Qwen<br/>клон template-go-api (+ харнес тестов)"]:::q
    CT["component → @wirth-tester · GLM<br/>RED-компонентные по контракту+сценариям"]:::g
    MOD["module → @hughes · Qwen<br/>RED → green; скилл по io:"]:::q
  end

  LING["@linger · GLM<br/>сборка→юнит→компонентные; снять @wip"]:::g
  MICH["@michtom · Qwen<br/>канарейка 1→5→25→100% + 4 сигнала"]:::q
  GR{{"rational-guardrail (--hard)<br/>блок hughes/wirth-tester без Gate #1 · маркер только оператор · decisions.log"}}:::guard

  IZI --> INT --> SL --> UC --> API --> MD --> TK --> PLN --> MILLS
  MILLS -->|blocker| LFIX -->|перезапуск| MILLS
  MILLS -->|OK / escalate| G1{{"Gate #1 — акцепт плана"}}:::gate
  OP -. пишет «акцепт» .-> G1
  GR -. форсит .-> G1
  G1 -->|разблок реализации| SC
  SC --> CT --> MOD --> LING --> G2{{"Gate #2 — мерж"}}:::gate
  OP -. мерж .-> G2
  G2 --> MICH --> G3{{"Gate #3 — приёмка после канарейки"}}:::gate
  OP -. приёмка .-> G3

  classDef q fill:#eafbea,stroke:#2f855a,color:#153f22;
  classDef g fill:#e3f0ff,stroke:#2b6cb0,color:#12345a;
  classDef h fill:#fff4d6,stroke:#b7791f,color:#5a3d00;
  classDef gate fill:#ffe3e3,stroke:#c53030,color:#5a1212;
  classDef guard fill:#efe3ff,stroke:#6b46c1,color:#2d1a5a;
```

## Легенда
- 🟩 **izi (Qwen)** — механический роутер: фикс. последовательность + чтение однострочных статусов
  + метки типов. Артефакты не читает, вердикты не сводит, уровень не оценивает.
- 🟦 **Wirth (GLM)** — всё планирование/проектирование/компонентные тесты (`@wirth-*`).
- 🟦 **Mills (GLM)** — верхнеуровневое ревью консистентности; 🟦 **Linger (GLM)** — локальный фикс.
- 🟩 **Hughes (Qwen)** — реализация scaffold/module; 🟩 **Michtom (Qwen)** — канареечный health.
- 🟨 **Оператор** — только 3 human-gate; «акцепт» на Gate #1 (touch-free через плагин).
- 🟪 **rational-guardrail** (`--hard`) — блок `hughes`/`wirth-tester` без Gate #1; маркер `gate1.approved` ставит только оператор.

## Ключевые принципы
- **Плоскость (depth 1):** izi делегирует субагентов напрямую; они дальше НЕ делегируют
  (вложенность subagent→subagent opencode не поддерживает — ask второго уровня не всплывает).
- **Один контракт на сервис:** `@wirth-apidesigner` вызывается ОДИН раз (не per-slice) → freeze до дизайна модулей.
- **Два прохода планирования:** дизайн срезов → нарезка тикетов (`@wirth-ticketer`, над всем планом).
- **Ревью верхнеуровневое:** Mills судит план как целое, не открывая каждый тикет; детали ловят этапы + компонентные + Linger.
- **Локальный фикс:** Linger чинит там, где проблема, сверяя контракт с вызывающим модулем — не переписывает план.
- **Без луупов:** `steps`-cap + счётчик попыток (K=2) + жёсткий блок guardrail → escalate оператору вместо кручения.
- **Скелет из шаблона:** scaffold-тикет (первый, сериализованно) клонирует `template-go-api`.
```
