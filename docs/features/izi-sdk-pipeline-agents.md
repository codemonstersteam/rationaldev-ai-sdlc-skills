# izi на Claude Agent SDK — отдельные конвейеры-агенты + пульт управления 🔴 (концепт)

> **Идея:** не раздувать один харнес условиями под каждую задачу, а собрать **каждый конвейер отдельным
> SDK-агентом** (`izi-create-service`, `izi-create-cli`, `izi-rework`) на **Claude Agent SDK**, поверх — тонкий
> **пульт** (терминал / веб), который выбирает конвейер, стримит прогресс и проводит человеческие гейты.
> Добавить конвейер = добавить программу, а не менять существующие. Ссылается из тикетов rework/pipelines.

## Зачем (мотива)

Сейчас харнес — рабочий агент **создания сервиса/CLI** (greenfield) на раннерах opencode/claude. Впихивать в него
brownfield/rework «режимом с условиями» → монолит с `if` по ролям (см. [`rework-workflow.md`](./rework-workflow.md)).
**Альтернатива:** конвейер — декларативная композиция переиспользуемых ролей; на SDK это естественно ложится как
**отдельная программа** `query()` с набором сабагентов-ролей, хуков-гардрэйлов и MCP-валидаторов. Разные задачи —
разные программы из одной библиотеки. Управление — единый пульт.

## Архитектура — три слоя

```
┌── СЛОЙ 3 · Пульт (control plane) ──────────────────────────────┐
│  терминал `izi run <pipeline> <task>` / веб: submit → stream →  │
│  approve gates (#1/#2/#3) → artifacts. Диспетчер выбирает       │
│  конвейер (по классификации задачи или явно).                   │
└───────────────┬────────────────────────────────────────────────┘
                ▼   запускает нужную программу
┌── СЛОЙ 2 · Конвейеры-агенты (SDK-программы, query()) ──────────┐
│  izi-create-service · izi-create-cli · izi-rework              │
│  каждая = своя композиция ролей + хуков + прав (свой список).  │
└───────────────┬────────────────────────────────────────────────┘
                ▼   композирует из общей библиотеки
┌── СЛОЙ 1 · Библиотека (переиспользуемая) ─────────────────────┐
│  роли → SDK-сабагенты (gilb/wirth-*/mills/hughes/…)            │
│  гардрэйлы → SDK-хуки (shared.mjs → PreToolUse: closed-set /    │
│    фронтдор / Gate #1 / регрессия; PostToolUse: decisions.log) │
│  валидаторы → MCP-tools (validate-plan/tickets/dod/…)          │
│  скиллы → системные промпты/референсы ролей                     │
└────────────────────────────────────────────────────────────────┘
```

**Ключ:** Слой 1 общий; конвейеры (Слой 2) отличаются только **композицией** (какие роли, в каком порядке, какие
хуки). Никаких `if pipeline` внутри ролей.

## Как работает харнес (верхнеуровнево)

1. Оператор подаёт задачу (терминал/веб): «создать sync-сервис X» / «rework: добавить поле в `/balance`».
2. **Диспетчер** классифицирует → выбирает конвейер-агента (`create-service|create-cli|rework`), либо оператор указывает явно.
3. **Конвейер-агент** (`query()`) исполняет свою композицию: сабагенты-роли по порядку, хуки-гардрэйлы enforce-ят, MCP-валидаторы гейтят артефакты.
4. **Человеческие гейты** всплывают в пульте (веб-карточка / терминал-промпт): #1 план · #2 мерж · #3 приёмка-после-канарейки. Акцепт — токен `GATE1 APPROVE` / кнопка.
5. **Стриминг** прогресса в пульт; **сессии** SDK дают паузу/resume/fork.
6. Артефакты (код/спека/README/план/тикеты) — в репозиторий; `decisions.log` — аудит.

Каждый конвейер-агент **независимо версионируется и тестируется**; новый конвейер не трогает существующие.

## Алгоритмы конвейеров (функциональный стиль)

Общий хребет — ROP-труба, короткое замыкание на STOP, человеческие гейты явны. Роли — сабагенты; `|>` — шаг трубы.

### `izi-create-service` (greenfield, sync|async)

```
createService(BR, profile) -> Result<Shipped, Stop>:
  | gilb(BR)                    ⇒ brd.md         # фронтдор: BR → измеримый BRD
  | triage |> intake           -> FRD            # уровень + функц. требования
  | slicer(FRD)                -> [Slice]        # вертикальные срезы, dependency-ordered
  | map(Slice, usecase)         -> [UseCase]     # Cockburn
  | apidesigner([UseCase], profile) -> Contract  # profile.protocol: OpenAPI | AsyncAPI, x-frozen
  | map(Slice, moduledesigner)  -> [ModuleTree+ADR]  # дерево модулей + ADR (design-фаза)
  | dijkstra(design)            -> README
  | ticketer(design)            -> [Ticket]      # scaffold + module + component
  | planner([Ticket]) |> mills  -> Plan(OK)      # план + ревью
  |———— GATE #1 (оператор: GATE1 APPROVE) ————
  | scaffolder(scaffoldTicket)  -> Skeleton      # git-клон шаблона + build/health
  | traverse(moduleTickets, hughes)  -> [Green]  # RED→GREEN per модуль (тесты @wirth-tester)
  | fagan(design, [Green])      -> Accepted      # DoD, Cleanroom (не hughes)
  |———— GATE #2: мерж ————
  | michtom(Accepted, toggle=on) -> Shipped      # канарейка за фиче-тогглом, 4 сигнала
  |———— GATE #3: приёмка после канарейки ————
```

### `izi-create-cli` (greenfield, target=cli)

Тот же хребет, отличается **узел контракта** и io:

```
  | apidesigner([UseCase], cli) -> config.schema + report.schema + exit-таблица   # НЕТ OpenAPI/AsyncAPI
  ...  io = cli-io (ingress); компонентные = CLI-чёрный-ящик
```

### `izi-rework` (brownfield, service|cli, sync|async) — 2×2

Полный алгоритм — в [`rework-workflow.md`](./rework-workflow.md). Кратко:

```
rework(task, repo) -> Result<Shipped, Stop>:
  | change-intake(task, repo)  -> Change ⇒ brd.md   # читает spec/дерево/тесты → {delta, rationale, changeType}
  | baselineGreen(repo.tests)   -> Baseline          # существующие компонентные = инвариант; red → STOP
  | r := route(changeType)                           # 2×2 таблицей: REFACTOR|BEHAVIOR|API|SPEC_ONLY
  | impact-map(delta, tree)     -> Impact
  | evolveContract(r.spec, protocol) -> Contract     # keep | evolve <OpenAPI|AsyncAPI|schema> + reverse(pinout)
  | moduledesigner(tree ВХОД, Impact) -> ModuleΔ      # ДЕЛЬТА, не с нуля
  | authorTests(r.tests, Baseline) -> TestΔ          # invariant→характеризация | extend→новый RED
  | ticketer(r.tickets, ModuleΔ) -> [Ticket]         # modify/refactor (не scaffold)
  | planner |> mills -> Plan(OK)
  |———— GATE #1 ————
  | traverse([Ticket], hughes-rework) -> [Green]     # read scoped → edit; |> regressionGate(Baseline)
  | fagan -> Accepted
  |———— GATE #2 · #3 ————   canary(toggle = r.tests≠invariant)
```

**Различия — данные, не код:** `profile` (protocol × service/cli) параметризует узел контракта/io; `route` (2×2)
параметризует spec/tests/tickets. Ветвление — таблицами, роли single-purpose.

## Отображение на примитивы SDK

| Механизм харнеса | Примитив Claude Agent SDK |
|---|---|
| Роль (gilb/wirth-*/hughes/…) | **сабагент** (`agents: {…}`, свой prompt/model/tools) |
| Роутер izi | родительский агент с `allowedTools: ["Agent"]` |
| Гардрэйлы (closed-set/фронтдор/Gate #1/регрессия) | **`PreToolUse`-хуки** → `permissionDecision:"deny"` (логика — общий `shared.mjs`, 1:1) |
| decisions.log | **`PostToolUse`-хук** (async append) |
| Валидаторы (plan/tickets/dod) | **MCP-tools** (`mcp__validators__validate_*`) |
| Человеческие гейты #1–3 | `AskUserQuestion` / `PermissionRequest`-хук + маркер + `GATE1 APPROVE` |
| Пауза/resume/fork прогона | **сессии** (`resume: sessionId`) |
| Прогресс в веб/терминал | **стриминг** сообщений (`for await … query()`) |
| Модель/права per роль | `model`/`tools` в `AgentDefinition` |

Общая чистая логика enforcement (`shared.mjs`: `PIPELINE`, `requiresFrontDoor`, `planReadyForApproval`,
`isOperatorApproval`, `gateMarkerContent`) переносится в SDK-хуки **без изменений** — она уже без builtin'ов.

## Пульт управления (терминал / веб)

- **Терминал:** `izi list` · `izi run <pipeline> <task>` · `izi resume <session>` · `izi approve <gate>`.
- **Веб:** форма задачи → выбор/классификация конвейера → live-стрим (дерево ролей, decisions.log) → карточки
  человеческих гейтов (Approve/hold) → артефакты (diff, спека, план, тикеты) на скачивание.
- Единый интерфейс для всех конвейеров: submit → stream → gate → artifacts. Пульт **не знает** внутренностей
  конвейера — только контракт «задача/сессия/гейт/артефакт».

## Сосуществование с текущим харнесом

- Текущий харнес (opencode/claude-раннеры, создание сервиса/CLI) **остаётся рабочим**; SDK-версия `izi-create-*`
  собирается из той же библиотеки ролей/скиллов и заменяет раннер-специфику единым TS-кодом.
- `izi-rework` — **новая отдельная программа**, не форк существующего (никакого «слона»).
- Миграция инкрементальна: сначала пульт + `izi-rework` на SDK; `create-*` портируются, когда выгодно.

## Открытые вопросы (проработать)

1. **Классификация задачи → конвейер:** отдельный лёгкий классификатор в пульте vs явный выбор оператором.
2. **Где живёт библиотека ролей** (общий пакет) и как конвейеры её версионируют, чтобы не разъехались.
3. **Человеческие гейты в вебе:** `PermissionRequest`-хук ↔ веб-очередь одобрений; провенанс (`GATE1 APPROVE`+хеш плана).
4. **Изоляция прогонов** (worktree per задача) и параллельные конвейеры под одним пультом.
5. **Границы MVP пульта:** терминал сначала, веб потом.

## Тикеты

- [ ] **S1 — библиотека ролей/скиллов/хуков как SDK-пакет** (Слой 1): сабагенты из `_shared/*`, хуки из `shared.mjs`, валидаторы как MCP.
- [ ] **S2 — `izi-rework` как первая SDK-программа** (Слой 2): композиция rework (см. `rework-workflow.md` T1–T7), гардрэйлы-хуки, регрессия-baseline MCP.
- [ ] **S3 — пульт-терминал** (Слой 3): `run/list/resume/approve`, стрим, проведение гейтов через `GATE1 APPROVE`.
- [ ] **S4 — портировать `izi-create-service`/`izi-create-cli`** на SDK из общей библиотеки (profile: protocol × cli).
- [ ] **S5 — веб-пульт** (после терминала): live-стрим + карточки гейтов + артефакты.
- [ ] **S6 — классификатор задачи → конвейер** (или явный выбор), диспетчер.

## DoD концепта

- Каждый конвейер — отдельная SDK-программа из общей библиотеки; добавление конвейера не трогает существующие.
- Гардрэйлы — SDK-хуки на общем `shared.mjs`; человеческие гейты #1–3 проходят через пульт.
- Пульт управляет всеми конвейерами единым контрактом (задача/сессия/гейт/артефакт) из терминала (веб — позже).
