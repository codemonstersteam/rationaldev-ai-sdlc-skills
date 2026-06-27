# План работ — превращение репозитория в эталон AI-first SDLC

> Источник процесса — `docs/story/00_PROCESS.md`. Этот файл — план рефакторинга
> репозитория под целевую модель. После приёмки исполняется блок за блоком.

## Цель

Репозиторий должен служить двум потребителям:

- **Человеку** — лаконичное README с описанием SDLC по `00_PROCESS.md`.
- **Агентам** — роли, разложенные по папкам, с манифестами «что грузить», и
  артефактами, разложенными по роли-владельцу, проверяемыми на полноту до старта.

**Сквозной критерий приёмки:** слабая модель может выполнить шаг процесса по
документам — каждому агенту ясно, какие артефакты нужны на вход, что он пишет на
выход, и как проверить вход на полноту перед началом работы.

## Базовая концепция: роль работает как модуль

Каждая агентская роль рассматривается как **программный модуль** с контрактом:

- **На входе — проверка диапазона значений (полноты данных):** роль не стартует,
  пока её входные артефакты не существуют и не полны (антецедент). Невыполнение → STOP.
- **На выходе — контроль выходных данных:** роль отвечает за полноту и корректность
  того, что она пишет в свою папку (консеквент).

Отсюда «модуль = роль»: разложение по папкам ролей — это разложение по модулям с
явными контрактами вход/выход, которые и проверяет слабая модель.

## Принятые решения (развязка неоднозначностей intent ↔ 00_PROCESS)

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | Два слоя скиллов | `docs/story/*` — доменные скиллы (ролевые обёртки); роли наполняются техниками из `skills/*` по ссылкам, файлы не дублируются |
| 2 | Роли vs модули | Единый словарь: модуль = агентская роль §3.2 с контрактом вход/выход; «проектировщик фичи» = Planner |
| 3 | План фичи | Источник правды — `.agent/planner/plan.md` в репо сервиса; `backlog.md` — рудимент |
| 4 | Док-скиллы | Раздаются внутрь существующих ролей, отдельную роль не заводим |
| 5 | Пути артефактов | Единое дерево `.agent/<роль>/`; роль не пишет в чужую папку (кроме общего `decisions.log`) |

## Целевая структура

### Артефакты (в репозитории сервиса)

```
<service-repo>/
  .agent/
    planner/
      plan.md                 # источник правды
      contracts/              # API-контракты (OpenAPI/AsyncAPI)
      network-topology.md     # связанность для security
      rollout-plan.md         # доля канарейки, тоггл, окна, SLO, план отката
      design/<slug>/          # пакет проектирования слайсов (was docs/design/<slug>/)
    plan-reviewer/
      plan-review.md
    implementer/              # код — в основном дереве репо; хендофф живёт в
                              # planner/design/<slug>/backlog.md (раздел «Хендофф»)
    release-health/
      deploy-log.md           # выкат канарейкой за тогглом
      release-health.md       # 4 золотых сигнала, вердикт GREEN/YELLOW/RED
    decisions.log             # сквозной журнал (append всеми ролями)
```

### Скиллы (в этом репозитории-эталоне) — единая библиотека + манифесты ролей

Большинство скиллов используются ≥2 ролями, поэтому копирование по ролям плодит дубли
и проблему путей. Канон — один в `skills/lib/`; роль — чистый манифест со ссылками.

```
skills/
  lib/                 # канонические тела скиллов, по одной копии (все — <name>/SKILL.md)
    architecture/ security/ code-style/ observability/          # домены
    program-design/ program-implementation/ component-tests/    # техники
    contract-tests/ http-io/ llm-client/ git-conventions/ documentation/
    communication/ memory/ doc-quality-review/ md-formatting/ platform-landing/
  roles/<role>/<role>.md   # манифест (генерится): грузит скиллы по имени, контракт вход/выход/STOP
  INDEX.json               # реестр скиллов + карта роль→скиллы (генерится)

# роли (6 + дирижёр): planner (Wirth) · plan-reviewer (Mills) · implementer (Hughes)
#   · fixer (Linger) · release-health (Michtom) · orchestrator (Witt, человек)
```

Правка скилла (напр. путь артефакта) — в одном месте `skills/lib/`, без рассинхрона копий.

### Контракт чтения/записи по ролям (вход/выход модуля)

| Роль (агент, модель) | Читает (вход) | Пишет (выход) |
|---|---|---|
| planner (Wirth, крупн.) | требования (вход дирижёра) | `planner/*` |
| plan-reviewer (Mills, крупн.) | `planner/plan.md`, `planner/design/` | `plan-reviewer/plan-review.md` |
| implementer (Hughes, мелк.) | `planner/plan.md`, `planner/design/<slug>/` (+ раздел «Хендофф» в его `backlog.md`) | код + PR |
| fixer (Linger, крупн./мелк.) | `planner/plan.md`, CI-сигналы | правки кода |
| release-health (Michtom, мелк./крупн.) | `planner/rollout-plan.md` | `release-health/*` (deploy-log.md, release-health.md) |
| все | — | `decisions.log` (append) |

### Манифест роли — формат `skills/roles/<role>/<role>.md`

```md
# Роль: <имя> | модель: <крупная|мелкая> | шаг процесса: <§N>
## Грузить (всё рядом в ./skills/): домены (.md) + техники (папки), ядро помечено
## Вход (проверка полноты, иначе STOP):  какие .agent/-артефакты должны существовать и быть полны
## Выход (контроль данных):  .agent/<роль>/...
## STOP-правила:     когда остановиться и эскалировать
```

### Наполнение ролей (в `roles/<role>/skills/`)

| Роль (агент) | Домены | Техники (ядро **жирным**) |
|---|---|---|
| planner (Wirth) | architecture, security | **program-design**, http-io, llm-client, platform-landing |
| plan-reviewer (Mills) | architecture, security | doc-quality-review, program-design (как рубрика полноты) |
| implementer (Hughes) | code-style | **program-implementation**, http-io, llm-client, component-tests, git-conventions, documentation, md-formatting |
| fixer (Linger) | code-style, security | component-tests, git-conventions, program-implementation |
| release-health (Michtom) | observability, security | *(пробел — новые техники, блок 2)* |
| orchestrator (Witt, человек) | — | doc-quality-review, platform-landing |

## Блоки работ

### Блок 0 — Словарь и каркас
- [x] Развернуть vertical-slice: `skills/roles/<role>/{<role>.md, skills/}` — скиллы скопированы по ролям, плоские оригиналы удалены.
- [x] 6 манифестов `<role>.md` (planner/plan-reviewer/implementer/fixer/release-health/orchestrator) с контрактом вход/выход/STOP.
- [ ] `GLOSSARY.md`: роль работает как модуль — проверка диапазона/полноты данных на входе и контроль выходных данных на выходе; модуль=роль, проектировщик фичи=Planner.
- [x] Процессные доки вынесены: `docs/00_PROCESS.md`, `docs/01_DIAGRAM.md`, `docs/SDLC.svg`. `docs/story/` остались дубли доменов (в `lib/`) + `intent.md` — **готова к удалению пользователем**.

### Блок 1 — Развязать противоречия
- [x] Единое дерево артефактов `.agent/<роль>/` (описано в разделе «Целевая структура»).
- [x] `program-design`: все пути `docs/design/<slug>/` → `.agent/planner/design/<slug>/` (вкл. хендофф `backlog.md`).
- [x] `program-implementation`: входное предусловие → тот же путь; хендофф = раздел в `design/<slug>/backlog.md`.
- [x] Секвенс Planning: сначала контракт + карта отказов, потом дизайн срезов — зафиксирован в `roles/planner/planner.md`.

### Блок 2 — Пробелы полноты → вынесены в отдельный бэклог

Недостающие скиллы **не реализуются в рамках этого рефакторинга**. Они оформлены
как самостоятельный бэклог для доменных команд (каждая пишет скилл по своему домену):
см. **[`SKILLS-BACKLOG.md`](SKILLS-BACKLOG.md)**.

Верхнеуровнево не хватает скиллов:
- **P0 (канареечный CD и безопасность нерабочи без них):** `canary-release`,
  `release-health-analysis`, `security-ci`, `error-classification`.
- **P1/P2 (вход и масштабирование):** `agent-ready-gate`, `epic-decomposition`.

Манифесты ролей `release-health`/`orchestrator` уже содержат секцию «ПРОБЕЛ (Блок 2)»
со ссылкой на будущие скиллы — команда дозаполнит их при поставке.

### Блок 3 — Документация для человека
- [x] README: лаконичный SDLC по `00_PROCESS` + поток + таблица «роль → скиллы → артефакты» + навигация.
- [x] Раздел «Масштабирование по объёму»: эпик → полный цикл; стори/фича → роль Planner + вход `.agent/planner/plan.md`.

### Блок 4 — Проверяемость
- [x] В каждом манифесте `<role>.md` — заполненные секции Вход/Выход/STOP (контракт модуля).
- [ ] Прогнать `doc-quality-review` по README и `00_PROCESS` (финальная проверка качества).

## Карта пробелов и противоречий (отслеживание)

| Тип | Пункт | Закрывается |
|---|---|---|
| 🔴 пробел | CD-роль release-health без техник | → `SKILLS-BACKLOG.md` (P0) |
| 🔴 пробел | нет скилла классификации ошибки | → `SKILLS-BACKLOG.md` (P0) |
| 🟡 пробел | нет входного agent-ready gate | → `SKILLS-BACKLOG.md` (P1) |
| 🟡 пробел | эпик-уровень не прошит | → `SKILLS-BACKLOG.md` (P1) |
| 🔴 противоречие | пути `docs/design/` vs `.agent/` | ✅ Блок 1 |
| 🟡 противоречие | порядок «контракт vs план» в Planning | ✅ Блок 1 |
