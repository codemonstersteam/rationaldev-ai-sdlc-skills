# Диаграмма целевого процесса

> **Векторная схема процесса:** [`SDLC.svg`](SDLC.svg) — открывается в браузере,
> отражает актуальный поток CI → канарейка (прежний растровый `SDLC.jpeg` удалён).
> Актуальный поток (как в `README.md`): PLANNING → PLAN REVIEW → Human Gate #1 →
> IMPLEMENTATION → CI (RRA-утилиты + security-scan) → CODE REVIEW → Human Gate #2 →
> канареечный релиз прямо в прод (Release & Health, агент Michtom: выкат ⇄ 4 золотых
> сигнала, доля канарейки 1%→5%→25%→100%) → Human Gate #3 (приёмка прод-релиза).
> Mermaid-схема ниже — тот же поток в текстовом виде.

```mermaid
flowchart TD
    Start([Задача сформулирована<br/>граница: конец Discovery]) --> Entry

    Entry{{ВХОДНОЙ GATE<br/>инженер-дирижёр:<br/>задача готова? agent-ready?}}
    Entry -->|переформулировать /<br/>рефакторинг границ| Start
    Entry -->|запуск| Plan

    subgraph PlanPhase[PLANNING - крупная модель]
        Plan[Planner Wirth пишет plan.md<br/>скиллы: architecture, security, component-tests]
    end

    Plan -->|plan.md в ветку| PlanReview

    subgraph ReviewPhase[PLAN REVIEW - крупная модель]
        PlanReview[Plan Reviewer Mills<br/>скиллы: architecture, security, component-tests]
    end

    PlanReview -->|проблема| Plan
    PlanReview -->|OK| Gate1{{HUMAN GATE 1<br/>инженер-дирижёр акцептует план}}
    Gate1 -->|доработать| Plan
    Gate1 -->|принято| Freeze[plan.md заморожен в репо<br/>источник правды]

    Freeze --> Impl

    subgraph ImplPhase[IMPLEMENTATION - мелкая модель]
        Impl[Implementer Hughes пишет код по плану<br/>скилл: code-style]
    end

    Impl -->|PR| CI

    subgraph CIPhase[CI PIPELINE]
        CI[component / contract / lint<br/>RRA-утилиты валидация решений +<br/>отдельный security-scan]
    end

    CI -->|ошибки| Classify{Классификация<br/>ошибки}
    Classify -->|дефект реализации| Impl
    Classify -->|дефект плана| Plan
    CI -->|всё зелёное| CodeReview

    subgraph CRPhase[CODE REVIEW - крупная модель]
        CodeReview[Fixer Linger проверяет PR]
    end

    CodeReview -->|правки| Impl
    CodeReview -->|OK| Gate2{{HUMAN GATE 2<br/>инженер-дирижёр: мерж}}
    Gate2 --> Merge([merge -> релизный артефакт<br/>фича-тоггл OFF])

    Merge --> Deploy

    subgraph Prod[КАНАРЕЕЧНЫЙ РЕЛИЗ ПРЯМО В ПРОД - цель: здорова под реальным трафиком<br/>вариативная среда: VM / контейнер / serverless]
        Deploy[Release & Health Michtom мелкая модель<br/>деплой в прод, health-check окружения<br/>тоггл OFF<br/>скиллы: observability, security]
        Deploy -->|окружение зелёное| Rollout[Michtom расширяет канарейку<br/>доля: 1% -> 5% -> 25% -> 100%]
        Rollout --> Health[Michtom крупная модель: анализ здоровья<br/>4 золотых сигнала + SLO + guardrail<br/>vs baseline<br/>скилл: observability]
        Health -->|YELLOW: держать долю,<br/>продлить наблюдение| Rollout
        Health -->|GREEN: расширить долю| Rollout
    end

    Deploy -->|smoke/health провал| ClassifyDeploy{Классификация<br/>дефект реализации /<br/>дефект деплоя}
    ClassifyDeploy -->|дефект реализации| Impl
    ClassifyDeploy -->|дефект конфига деплоя| Deploy
    Health -->|RED: откат| Rollback[ОТКАТ<br/>тоггл OFF / откат версии]
    Rollback --> Escalate
    Rollout -->|100% и стабильно N времени| Gate3{{HUMAN GATE 3<br/>дирижёр: приёмка прод-релиза<br/>после канарейки, мелкие фичи - авто}}
    Gate3 --> Done([Фича принята<br/>тоггл -> cleanup-тикет])

    Classify -.->|лимит итераций<br/>исчерпан| Escalate[ЭСКАЛАЦИЯ<br/>инженеру-дирижёру]
    CI -.->|бюджет исчерпан| Escalate
    ClassifyDeploy -.->|лимит / непонятно| Escalate

    style Entry fill:#ffe6cc
    style Gate1 fill:#ffe6cc
    style Gate2 fill:#ffe6cc
    style Gate3 fill:#ffe6cc
    style Escalate fill:#ffcccc
    style Rollback fill:#ffcccc
    style Freeze fill:#d5e8d4
    style Merge fill:#d5e8d4
    style Done fill:#d5e8d4
```

## Цикл Ralph Loop

Замкнутая часть `IMPLEMENTATION → CI → классификация → IMPLEMENTATION/PLANNING` крутится до выполнения стоп-условия:

- **Успех:** всё зелёное в CI + пройден code review крупной модели.
- **Принудительный выход:** превышен лимит итераций (рекоменд. 5 фиксов / 2 репланирования) или исчерпан бюджет токенов/GPU-времени → эскалация человеку.
- **Защита:** агент не может менять тесты, CI-конфиги и пороги покрытия для «позеленения» — такие изменения требуют отдельного human review.

## Цикл Rollout Loop

Замкнутая часть `расширить долю канарейки → POST-DEPLOY наблюдение → вердикт → расширить/держать/откатить` крутится по доле канарейки (1% → 5% → 25% → 100%) до выполнения стоп-условия:

- **Успех:** все 4 золотых сигнала и SLI в пределах SLO, guardrail не просел против baseline на достаточном окне → раскатка дошла до 100% и стабильна → фича принята.
- **Держать (YELLOW):** сигналы пограничны или окна наблюдения не хватило → текущая доля канарейки удерживается, расширение запрещено.
- **Принудительный выход (RED):** нарушен SLO / всплеск ошибок-латентности / просадка guardrail / горит error budget → немедленный откат (тоггл OFF) и эскалация человеку.
- **Асимметрия:** внутри Release & Health (Michtom) фаза выката (мелкая модель) катит, а фаза анализа здоровья (крупная модель) оценивает и решает об откате — генератор и критик не совпадают, как и в CI/code review.
- **Защита:** агент не может ослаблять SLO, глушить алерты или трактовать отсутствие данных как «зелёно» ради продвижения раскатки — анти-gaming, симметричный запрету «позеленения» тестов.
