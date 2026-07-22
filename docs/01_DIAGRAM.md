# Диаграмма целевого процесса

> Поток целиком: измеримый BRD → **вес по SemVer** → вертикаль → Gate #1 → реализация → DoD →
> PR/CI → Gate #2 → **закрытие прогона** (пруф мерджа → тег → `LEDGER.md` → вайп `.agent/`) →
> канарейка + 4 золотых сигнала → Gate #3. Роли и правила — [`00_PROCESS.md`](00_PROCESS.md);
> граф делегирования харнеса — [`harness-flow.md`](harness-flow.md); пошагово по весу —
> [`flows/`](flows/).
>
> `SDLC.svg` — **устаревшая** векторная схема (нарисована до SemVer-вертикалей); источник правды —
> Mermaid ниже.

## Общий хребет

```mermaid
flowchart TD
    Start([Требование сформулировано<br/>граница: конец Discovery]) --> Gilb

    Gilb["ФРОНТ-ДОР · @gilb<br/>сырое требование → измеримый BRD<br/>открытые вопросы → оператору по одному"]
    Gilb --> Triage{"ТРИАЖ · @wirth-triage<br/>ВЕС по SemVer 2.0.0<br/>ось: обратная совместимость контракта"}

    Triage -->|chore| Chore["CHORE-PLAN.md<br/>файлы · команда верификации · откат"]
    Triage -->|greenfield| Green["FRD → срезы → use-case →<br/>ЗАМОРОЗКА контракта → дерево модулей → README"]
    Triage -->|patch| Patch["change-delta + discriminating<br/>контракт НЕ трогается"]
    Triage -->|minor| Minor["аддитивная эволюция контракта<br/>--require-additive = 0 breaking"]
    Triage -->|major| Major["редизайн + миграция<br/>breaking-список в тело PR"]
    Triage -->|epic / unclear| Stop["STOP → оператор"]

    Minor -->|найден breaking| Triage

    Green --> Tickets
    Patch --> Tickets
    Minor --> Tickets
    Major --> Tickets
    Tickets["ТИКЕТЫ · @wirth-ticketer<br/>покрытие по весу; тип: scaffold|component|module"] --> Plan
    Plan["ПЛАН · @wirth-planner<br/>индекс путей + сводка Gate #1"] --> Review

    Review["РЕВЬЮ ПЛАНА · @mills<br/>OK | blocker | escalate"]
    Review -->|blocker| Fix1["@linger — локальный фикс"]
    Fix1 --> Review
    Review -->|OK / escalate| Gate1
    Chore --> Gate1

    Gate1{{"HUMAN GATE #1 — акцепт плана<br/>токен GATE1 APPROVE"}}
    Gate1 -->|доработать| Plan
    Gate1 -->|принято| Branch["@git-hand mode=start<br/>ветка type/slug от свежего транка"]

    Branch --> Impl["РЕАЛИЗАЦИЯ по тикетам<br/>@wirth-tester RED · @hughes / @hughes-rework"]
    Impl --> Layout["validate-layout — раскладка кода"]
    Layout -->|leak| Fix2["@linger — фикс (K=2)"]
    Fix2 --> Impl
    Layout -->|clean| Dod

    Dod["DoD-ПРИЁМКА · @fagan<br/>сборка/тесты/README + инвариант веса<br/>снимает @wip"]
    Dod -->|FAIL| Fix2
    Dod -->|accepted| Terminal

    Terminal["@git-hand mode=terminal<br/>commit → push → PR (вес в заголовке) → CI"]
    Terminal -->|ci=red| Fix2
    Terminal -->|ci=green| Gate2

    Gate2{{"HUMAN GATE #2 — мерж<br/>токен GATE2 APPROVE"}}
    Gate2 --> Close

    Close["ЗАКРЫТИЕ ПРОГОНА · @ledger → close-run.mjs<br/>пруф мерджа → тег (semver-bump) →<br/>docs/changes/LEDGER.md → вайп .agent/"]
    Close -->|no-bump| Done
    Close -->|тег| Deploy

    subgraph Prod["КАНАРЕЕЧНЫЙ РЕЛИЗ ПРЯМО В ПРОД · вариативная среда: VM / контейнер / serverless"]
        Deploy["@michtom: деплой, тоггл OFF,<br/>health окружения"]
        Deploy --> Rollout["расширение доли: 1% → 5% → 25% → 100%"]
        Rollout --> Health["@michtom (анализ): 4 золотых сигнала +<br/>SLO + guardrail vs baseline"]
        Health -->|YELLOW: держать долю| Rollout
        Health -->|GREEN: расширить| Rollout
    end

    Health -->|RED: откат| Rollback["ОТКАТ — тоггл OFF / откат версии"]
    Rollback --> Escalate
    Rollout -->|100% и стабильно| Gate3{{"HUMAN GATE #3<br/>приёмка прод-релиза"}}
    Gate3 --> Done([Фича принята<br/>тоггл → cleanup-тикет])

    Fix2 -.->|K=2 исчерпан| Escalate["ЭСКАЛАЦИЯ инженеру-дирижёру"]
    Review -.->|раунд ≥1 с блокером| Escalate

    style Gate1 fill:#ffe6cc
    style Gate2 fill:#ffe6cc
    style Gate3 fill:#ffe6cc
    style Stop fill:#ffcccc
    style Escalate fill:#ffcccc
    style Rollback fill:#ffcccc
    style Close fill:#d5e8d4
    style Done fill:#d5e8d4
```

## Что решает вес

| Вес | Голова конвейера | Транк | Канарейка |
|---|---|---|---|
| `greenfield` | полный дизайн-пакет + scaffold | `1.0.0` | да |
| `patch` | дельта + discriminating, контракт не трогается | `Z+1` | да |
| `minor` | аддитивная эволюция контракта, тоггл OFF | `Y+1.0` | да (способность выключена) |
| `major` | редизайн + миграция + breaking-список | `X+1.0.0` | да |
| `chore` | `CHORE-PLAN.md`, без дизайна и компонентных | **no-bump** | нет |

## Цикл Ralph Loop

Замкнутая часть `реализация → валидатор/DoD/CI → классификация → фикс` крутится до стоп-условия:

- **Успех:** `@fagan accepted` + зелёный CI на PR + инвариант веса доказан.
- **Принудительный выход:** предохранитель `@linger` K=2 или исчерпанный бюджет → эскалация человеку.
- **Защита:** агент не может менять тесты, CI-конфиги и пороги ради «позеленения»; на `minor` правка
  существующего контрактного теста — блокер (сигнал неверного веса).

## Цикл Rollout Loop

Замкнутая часть `расширить долю → наблюдение → вердикт → расширить/держать/откатить` (1% → 5% →
25% → 100%):

- **Успех:** 4 золотых сигнала и SLI в пределах SLO, guardrail не просел против baseline → 100% стабильно.
- **Держать (YELLOW):** сигналы пограничны или окна не хватило — расширение запрещено.
- **Принудительный выход (RED):** немедленный откат (тоггл OFF) + эскалация.
- **Асимметрия:** фаза выката (малый тир) не совпадает с фазой анализа здоровья (большой тир).
- **Защита:** нельзя ослаблять SLO, глушить алерты или трактовать отсутствие данных как «зелёно».
