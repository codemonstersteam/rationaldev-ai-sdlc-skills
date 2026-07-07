# Backlog — rationaldev (мета-репо SDLC)

Дорожная карта **самого репозитория** (методология AI-first рационального SDLC, агенты izi).
Не путать с шаблоном разработки сервиса — он в [`template/backlog.tmpl.md`](template/backlog.tmpl.md).
Поток работы — Trunk Based Development: ветка живёт 1–2 дня, один PR в `main` за шаг (`AGENTS.md`).

## Todo

> Унификация скиллов/ролей (DRY: A, A2, B, C, D, D2, E) — **завершена**, см. Done.

### Перевод скиллов на английский (i18n) — оптимум, не минимум
Цель: все `skills/lib/*` на английском, лаконичные, без потери сути; tier-agnostic (GLM…Opus).
Статус: 2/17 (`http-io`, `program-implementation`). Осталось 15 (крупные первыми: `md-formatting` 511,
`component-tests` 332, `git-conventions` 290, `documentation` 280, `llm-client` 231, `platform-landing` 223,
`doc-quality-review` 173, `observability` 134, `architecture` 116, `program-design` ×reference 1234,
`code-style` 92, `memory` 88, `security` 74, `contract-tests` 63, `communication` 37).

**Раскладка тиров (упоминать в релевантных скиллах):** `large`=opus (planner/plan-reviewer/fixer/
orchestrator) · `medium`=sonnet (release-health) · `small`=haiku (implementer).

- [x] **Фаза 0 — подготовка.** Глоссарий RU→EN + список «литералов» (кросс-скилл строки) собраны в
  [`skills/I18N.md`](skills/I18N.md): единый перевод терминов, раскладка тиров, 9 литералов с парами
  писатель→читатель (остаются RU до Фазы 3).
  - _MUST:_ глоссарий и список литералов готовы до первого перевода; литералы остаются RU, пока вся
    цепочка-потребитель не переведена.
- [ ] **Фаза 1 — перевод+лаконизация (1 скилл = 1 ветка = 1 PR).** Перевести по глоссарию, сжать
  (дедуп, ссылка вместо повтора чужих правил), усилить твёрдые правила `MUST`/`MUST NOT`, замерить токены,
  `gen-skill-index --check` + smoke, PR.
  - _MUST:_ `name` неизменен; `description` в форме «когда / когда НЕ»; сохранены все STOP/таблицы/
    формулы/код/чеклисты; твёрдые гейты как `MUST`/`MUST NOT`; кросс-скилл литералы остаются RU;
    `--check`+smoke зелёные до коммита; если скилл называет тир роли — по раскладке выше (implementer
    «small (haiku)», release-health «medium (sonnet)», large-роли «large (opus)»).
  - _MUST NOT:_ удалять контент ради цели по строкам; смешивать языки в прозе (кроме литералов);
    мержить полусвип; хардкодить «слабую модель (Qwen3.5)» как единственный таргет; пинить конкретную
    модель в скилле, общем для нескольких ролей (модель несёт манифест роли — тир абстрактно).
- [ ] **Фаза 2 — тест (после каждого скилла/батча).** (1) Семантический дифф RU↔EN: ни один
  STOP/гейт/таблица/формула не потерян. (2) Golden-task A/B на целевых моделях (слабая GLM/Qwen +
  сильная Opus), ≥3 прогона/сид. (3) Оценка по рубрике твёрдых гейтов (бинарно).
  - _MUST:_ тест на целевой модели, не только сильной; EN соблюдает гейты не хуже RU (в пределах шума);
    токены перемерены на токенайзере Qwen перед выводом об экономии (`o200k` — прокси).
  - _MUST NOT:_ принимать перевод, ломающий любой твёрдый гейт (даже при экономии); засчитывать один прогон.
- [ ] **Фаза 3 — завершение.** Перевести оставшиеся литералы в EN (вся цепочка на EN); заменить
  framing «слабую модель/Qwen3.5» → tier-agnostic; финальный smoke + полный дифф-аудит.
  - _MUST:_ литерал переводить только когда писатель И читатель уже на EN.
  - _MUST NOT:_ оставлять в реестре смешанный язык (всё EN или явно отложенные RU-литералы).

### Инфраструктура репозитория
- [ ] Сверить сквозные номера версий доков/скиллов (часть `v1.0`, observability `v2.0`, contract-tests `0.1/draft`) — версии скиллов/ролей теперь машиночитаемы в `skills/INDEX.json`
- [ ] `docs/02_MEASUREMENT.md §2.4` — переименовать «Платформа данных / Аналитика-отчётность» → «Отчётность» (analytics как роль убран)

### Детерминированный генератор тикетов по дизайну (ticketer)
Причина: GLM-ticketer игнорирует прозу декомпозиции и схлопывает слайс в один монстр-тикет
(прогон 05-07, `ticket-03` = весь слайс → зависание Qwen). Нарезка «1 узел module-tree = 1 тикет» —
**механическая проекция**, а не суждение; отдать её скрипту, у GLM оставить только тела.
- [ ] **Генератор стабов** `harness/gen-tickets.mjs`: из дизайн-пакета строит **форму** бэклога —
  фикс-слоты `scaffold` + `component(RED,@wip)` + **N module** (1 узел дерева = 1 стаб) + `final`
  (wiring+README+DoD-N). Header (`id/type/io/skills/blocked_by/inputs`) проставляется механически
  (scaffold-корень, module→component edge, final→всё); тело пустое. Роль ticketer заполняет только тела.
  - _Входы (машиночитаемы):_ `module-tree.md` (node→file+io), набор сценариев (формула `1+Σ`), `TASK §DoD`.
  - _MUST:_ `component` из **сценариев** (не из дерева); `green`/снятие `@wip` — акт фиксера, не тикет;
    `final` без модульной логики; не трогать §6/тестовую модель.
- [ ] **Валидатор биекции** в `validate-plan.mjs`: узлы module-tree ↔ module-тикеты **1:1** (узел без
  тикета или тикет на >1 узел = blocker на Gate #1) + тест. Страховка на случай ручной нарезки.
- _Альтернатива (дешевле, уже частично внедрено):_ оставить нарезку за GLM, но с формулой P→Q +
  self-check в манифесте ticketer (коммит `f362b3b`) и валидатором биекции как гейтом. Решить: генератор
  (решение убрано у GLM) vs формула+гейт (GLM режет, гейт ловит). См. сессию 05-07.

### Флаки tool-call Qwen-имплементера (dropout)
Прогон 05-07/2-harnes: Qwen (`hughes`) на ticket-07 выдал tool-call с несуществующим именем →
OpenCode отбил как «unavailable tool 'unknown'» → пустой возврат → dropout (2 ретрая, дожал @linger).
Диагностика — `~/.local/share/opencode/log/opencode.log` + `opencode.db` (part-таблица). Причина —
формат function-call модели, **не** размер/декомпозиция тикета (head/logic/Store прошли чисто).
- [ ] **Пин провайдера OpenRouter для Qwen** (как `GLM_IGNORE_PROVIDERS=Novita`) — возможно, кривой
  формат даёт конкретный провайдер-роут; проверить до смены модели. _Дёшево, первый шаг._
- [ ] **Харнес-митигейт:** на «unavailable tool 'unknown'» — не отдавать пустой результат вверх, а
  ретраить подагента с repair-подсказкой (доступные тулы) → следствие: одиночный кривой вызов не роняет тикет.
- [ ] **Свап small-тира** на модель с надёжным structured tool-calling того же класса (~24–32B) —
  если пин+митигейт не снимают. A/B через прокси, тиры в `models.config.json` свап-абельны.

### Толстый final уходит в серию ретраев (не dropout)
Прогон 07-07/1 (run08, valid-by-construction): `ticket-14` (final/DoD-closure) ушёл в **retry×4**,
все дожаты в green — но это НЕ флаки tool-call, а реальная нагрузка на реализатора: wiring+README+
DoD-N в одном звене. Симптом устойчив между прогонами (06-07: толстый final ~16мин). Отдельно от
dropout-митигейта выше.
- [ ] **Разгрузить final:** вынести wiring/config/observability из `final` в свои module-тикеты
  (генератор стабов `gen-tickets.mjs` уже проектирует слоты) → final несёт только DoD-замыкание.
  Кандидат-правило в `program-implementation`/ticketer: final без прикладной логики и без сборки >1 узла.

### Скиллы из `SKILLS-BACKLOG.md` (детерминированные процедуры)
Очередь и DoD — в [`SKILLS-BACKLOG.md`](SKILLS-BACKLOG.md). Кратко по приоритету:
- [ ] **P0** `canary-release` — выкат канарейкой за тогглом на вариативную среду (роль Michtom)
- [ ] **P0** `release-health-analysis` — 4 золотых сигнала + вердикт GREEN/YELLOW/RED (роль Michtom)
- [ ] **P0** `security-ci` — security-scan в CI, «секрет в коде = блок мержа» (роль Linger)
- [ ] **P0** `contract-tests` — довести черновик `skills/lib/contract-tests/` до полной процедуры (проверка через `pinout`); сейчас помечен `version 0.1 / status: draft` в реестре, ни одна роль на него не ссылается
- [ ] **P0** `error-classification` — план vs реализация vs конфиг (роли Linger, Witt)
- [ ] **P1** правила безопасной разработки — вшить в `program-design` / `program-implementation`
- [ ] **P2** `agent-ready-gate`, `epic-decomposition` (роль Witt)
- [ ] **P3 (опц., только под нагрузку)** `load-capacity`, `high-availability`

### Согласованность методологии
- [ ] Прогнать `doc-quality-review` по обновлённым ролям и `skills/lib/observability/SKILL.md`
- [x] ~~Проверить, что манифесты ролей ссылаются только на существующие скиллы~~ — автоматизировано: `gen-skill-index.mjs --check` (в smoke) валит сборку на битой ссылке роль→скилл

## Done

### Унификация скиллов и манифестов ролей (DRY) — ветка `feat/role-single-source`
- [x] **A — единый источник правды роли:** идентичность (`version/tier/mode/temperature/steps/skills/inputs/outputs/permission/description`) в frontmatter `harness/agents/_shared/<role>.md`; хардкод `META` из `gen-agents.mjs` удалён, генератор читает frontmatter и валидирует обязательные поля
- [x] **A2 — `skills/roles/<role>/<role>.md` генерируется** из `_shared` (4-я проекция, помечена «не редактировать»); рукописный дубль роли устранён
- [x] **B — единый формат скиллов:** 4 плоских доменных (`architecture/code-style/observability/security`) → `skills/lib/<name>/SKILL.md` + frontmatter; починен баг `install.sh` (линковал только `<dir>/SKILL.md` — плоские не ставились). Все 17 скиллов единого формата
- [x] **D — реестр `skills/INDEX.json` + CI-инвариант ссылок:** `gen-skill-index.mjs` строит реестр и валит сборку на скилле-призраке; общий парсер `harness/frontmatter.mjs`; проверка `--check` в smoke
- [x] **D2 — целостность пайплайна:** `inputs/outputs` в ролях + проверка «каждый вход внешний или производится апстрим-шагом» (DAG-обобщение `outputs[N] ⊇ inputs[N+1]`)
- [x] **C — progressive disclosure `program-design`:** `SKILL.md` 1053 → 111 строк, тело 12 шагов в `reference/step-NN-*.md` (split байт-в-байт)
- [x] **E — адресация скиллов по имени:** скилл→скилл ссылки `skills/<name>/SKILL.md` нормализованы в имена; один механизм
- [x] Регрессий нет: проекции claude/opencode/codex байт-в-байт на каждом шаге; harness smoke PASS 21

- [x] Переработка из `rational-skills-ai` под дерзкий рациональный SDLC (человек + машина)
- [x] **6 ролей-агентов izi** с кодовыми именами: Wirth, Mills, Hughes, Linger, Michtom, Witt
- [x] Слияние ролей Release + SRE → **Release & Health** (агент Michtom)
- [x] Канареечный CD без тестовых сред: CI → канарейка за тогглом на вариативные среды; 3 человеческих гейта
- [x] Мониторинг сведён к **4 золотым сигналам** (latency/traffic/errors/saturation) + SLO/guardrail/baseline
- [x] Удалены скиллы `tech-radar`, `qa`; `analytics` схлопнут в продуктовую разработку (Discovery инженер+ИИ)
- [x] Новый скилл `contract-tests` (контракты через `pinout`); CI использует утилиты экосистемы RRA
- [x] Вычищены биг/фин-тех и банковский контекст из всех доков, ролей и скиллов
- [x] Научный фундамент в `CONCEPT.md`: труды Wirth / Hughes & Michtom / Linger, Mills, Witt + статьи автора
- [x] `CONCEPT.md`, `README.md`, `GLOSSARY.md`, `CLAUDE.md` переработаны
- [x] Диаграмма `docs/SDLC.svg` (заменила растровый `.jpeg`) перерисована под CI → канарейку
- [x] Презентация `presentation/sdlc.html` (10 слайдов) под новый процесс, открывается локально
- [x] Первый коммит и публикация на GitHub: `codemonstersteam/rationaldev-ai-sdlc-skills` (private)
- [x] validate-constructors: парсить конструкторы и из code-block-дерева module-tree (не только строк-таблицы) — иначе module-tree-режим не активируется, падает в эвристику (обнаружено на run08, EnforceEmptyPolicy/NewServiceEntry в code-fence). Сделано (`94f487a`): парсер берёт узлы constructor/subtype из строки-таблицы ИЛИ code-fence-дерева, `NewX` голый/в backtick'ах; на снапшоте run08 режим module-tree активен (ServiceEntry, Catalogue)
- [ ] mills: blocker если узел читает флаг/политику из Deps без записи в data-dictionary Configuration fields (untraced knob) — правило config-флагов (requirements-intake §7 + step-07)
- [ ] mills/design-rule: дизайн НЕ имеет права закрывать FRD open-question сам (тем более конфиг-кнобом) — open-question решает оператор на Gate #1 (обнаружено run08: EmptyPolicy материализовал open-question 'empty store semantics')
- [ ] **P1** ticket-header: завести поле outputs: (машинно-читаемые выходные файлы тикета) — ticketer пишет, validate-tickets проверяет; пререквизит для guardrail poka-yoke (обнаружено run08: в заголовке есть id/type/slice/blocked_by/inputs/io/skills, но НЕ outputs → джигу нечего проверять). Поднят до P1: связка outputs→poka-yoke ловит ровно дефект run08 (`/health` route опущен в ticket-13, пойман только приёмкой linger, а не гейтом)
- [ ] **P1** guardrail poka-yoke (rational-guardrail.ts): перехват дозаписи 'ticket-NN <slice> green' в done.log → deny если outputs-артефакт(ы) тикета отсутствуют/пусты (дешёвая проверка существования, НЕ build). ЗАБЛОКИРОВАН на outputs:-поле выше. Часть changeset self-append (self-append+izi genchi-genbutsu уже применены, gen-agents перегенерён). Сдвигает ловлю пропущенного выхода тикета с приёмки (linger, дорого) на запись done.log (дёшево)

## Тикеты — run08-changeset + izi-валидация (DAG, по скиллу тикетера)

Разбор переплетённого run08-changeset (рабочее дерево) + открытых izi-валидационных пунктов в
**атомарные, независимо-тестируемые тикеты** с явными зависимостями. Формат — `implementation-ticket-writer`
(строгая машинная шапка + минимальный контекст + atomic + `blocked_by`), адаптирован под repo-self:
поля `slice`/`io`/`skills` (io-роутер продукта) **неприменимы** → опущены; вместо них `verify` (изолированный
тест: одно изменение → один прогон) и `realizes` (пункт бэклога). Каждый тикет — своя ветка/PR.

**Граф зависимостей:**
```
T01 ─┐
     ├─► T03            T05 (незав.)     T06 (незав.)
T02 ─┘
T02 ─► T04              T07 ── blocked_by: PR #39 merged
```
**Волна 1 (outputs/poka-yoke)** = `T01 → T02 → T03` (+ `T04` как потребитель маркера).

---

### T01 — ticket-header: поле `outputs:`
```yaml
id: 01
type: harness-validator
blocked_by: []
inputs:  [harness/lib/validators.mjs, harness/validate-tickets.mjs, skills/lib/implementation-ticket-writer/SKILL.md]
outputs: [harness/lib/validators.mjs, harness/validate-tickets.mjs, harness/agents/_shared/wirth-ticketer.md]
```
- [ ] `validateTicketHeaders`: `outputs: [paths,…]` (flow-массив) в схему рядом с `inputs`; для `type: module|final` — обязателен, иначе blocker
- [ ] `validate-tickets.mjs`: существование/непустота путей `outputs` (как уже для `inputs`, L50–53)
- [ ] `wirth-ticketer.md` (`_shared`) + скилл `implementation-ticket-writer`: шапка требует `outputs:`; регенерация проекций `gen-agents.mjs`
- **verify:** `node --test harness/test/validators.test.mjs` — кейсы: тикет `module` без `outputs` → blocker; путь `outputs` не существует → error. + `bash harness/smoke/run.sh` PASS
- **realizes:** L132 (P1)

### T02 — producer-роли: durable done.log-маркер
```yaml
id: 02
type: role-manifest
blocked_by: []
inputs:  [harness/agents/_shared/{hughes,scaffolder,wirth-tester,linger}.md]
outputs: [harness/agents/_shared/{hughes,scaffolder,wirth-tester,linger}.md, harness/agents/{claude,codex,opencode}/*, skills/roles/*]
```
- [ ] hughes/scaffolder/wirth-tester/linger self-append `echo "ticket-NN <slice> green" >> .agent/planner/done.log` **только на green** (final DoD-действие) — уже в рабочем дереве, вынести на ветку
- [ ] проекции `claude/codex/opencode` + `skills/roles/*` регенерированы из `_shared` (`gen-agents.mjs`), руками не правлены
- **verify:** `gen-agents.mjs --check` (проекции консистентны) + `bash harness/smoke/run.sh` PASS 24
- **note:** текст ссылается на «guardrail rejects if artifact missing» — поведение вводит T03; допустимо, док чуть впереди гейта

### T03 — guardrail poka-yoke (ядро Волны 1)
```yaml
id: 03
type: guardrail
blocked_by: [01, 02]
inputs:  [harness/enforcement/opencode/rational-guardrail.ts, harness/enforcement/opencode/guardrail.smoke.ts]
outputs: [harness/enforcement/opencode/rational-guardrail.ts, harness/enforcement/opencode/guardrail.smoke.ts]
```
- [ ] хук `tool.execute.before`, ветка `bash`: перехват дозаписи `ticket-NN <slice> green` в `.agent/planner/done.log` → **deny**, если `outputs`-артефакт(ы) тикета отсутствуют/пусты (только существование, НЕ build)
- [ ] источник `outputs` — заголовок тикета из T01; сопоставление ticket-NN → его `outputs`
- **verify:** `guardrail.smoke.ts` — маркер без артефакта → deny; с непустым артефактом → allow
- **realizes:** L133 (P1). Зависит: T01 (поле `outputs`) + T02 (маркер пишется)

### T04 — izi: consume-marker + genchi-genbutsu dropout
```yaml
id: 04
type: role-manifest
blocked_by: [02]
inputs:  [harness/agents/_shared/izi.md]
outputs: [harness/agents/_shared/izi.md, harness/agents/{claude,codex,opencode}/izi.md, harness/instructions/AGENTS.codex.md, skills/roles/izi/izi.md]
```
- [ ] izi детектит завершение **по маркеру в ledger, не по reply-тексту**; advance/skip только при маркере **И** чистом `validate-layout`
- [ ] dropout (пустой возврат без `FAIL:`) → genchi-genbutsu: (1) маркер+layout → advance; (2) маркер нет, но артефакт есть+`go build` green → дописать маркер сам; (3) артефакта нет/build red → andon stop, retry ≤2 → escalate
- [ ] **hunk-хирургия:** взять из `izi.md` (`_shared`) **только** хунки маркера/dropout, оставив Gate#1-презентацию (T05); регенерация проекций
- **verify:** `gen-agents.mjs --check` + `bash harness/smoke/run.sh` PASS. Зависит: T02

### T05 — Gate #1: презентация плана оператору
```yaml
id: 05
type: role-manifest
blocked_by: []
inputs:  [harness/agents/_shared/{izi,wirth-planner}.md]
outputs: [harness/agents/_shared/{izi,wirth-planner}.md, harness/agents/{claude,codex,opencode}/*, harness/instructions/AGENTS.codex.md, skills/roles/*]
```
- [ ] izi «present plan first» — вывод `PLAN.md` Gate#1-summary verbatim (head-pipe + failure-map + ticket-list) перед accept-`question`
- [ ] wirth-planner: `PLAN.md` inline'ит head-pipe функц. блок + failure-mode map (единственная разрешённая копия, остальное — ссылки)
- [ ] **hunk-хирургия** относительно T04: izi-презентация-хунк отдельно от marker-хунка; сериализация с T04 по одному файлу `izi.md`
- **verify:** `gen-agents.mjs --check` + `bash harness/smoke/run.sh` PASS. Независим (кроме порядка правки `izi.md` с T04)

### T06 — feasibility-валидаторы тикетов на Gate #1 (гейтить, не генерить)
Ловят механические ошибки ticketer **до реализации** (не в рантайме). Принцип: LLM пишет тикет как сейчас,
гейт проверяет инвариант. **generate = предотвратить (системный риск), validate = поймать (выброс, безопасно)** —
кривой валидатор = пропуск, не порча всех тикетов; меньше парсинга (нужны имена узлов, не весь скелет);
стек-агностик; по грани проекта (уже есть `validate-frd/tickets/plan/layout/constructors`). Поглощает T10/thin-final
(из манифест-правил → в детерминированный гейт).
```yaml
id: 06
type: harness-validator
blocked_by: []
inputs:  [harness/validate-plan.mjs, harness/validate-tickets.mjs, harness/lib/validators.mjs]
outputs: [harness/validate-plan.mjs, harness/validate-tickets.mjs, harness/lib/validators.mjs]
```
- [ ] **биекция:** узел module-tree без тикета **ИЛИ** module-тикет на >1 узел = blocker (1:1).
- [ ] **scaffold-feasibility:** `outputs` scaffold-тикета == известный выход `scaffold.sh` (`cmd/app`, `go.mod`,
  `internal/<slug>/…`) — не выдуманный `cmd/<svc>`. Убирает T10 by construction.
- [ ] **module-outputs ⊆ module-tree:** пути `outputs` module-тикета соответствуют файлам его узла.
- [ ] **тонкий final:** final-тикет — ≤N accept-пунктов **И** нет logic-файлов в `outputs` (только wiring/README/
  deploy/DoD). Убирает thin-final by construction.
- **verify:** `node --test harness/test/validators.test.mjs` — синтетика: узел-сирота → blocker; тикет-монстр → blocker;
  scaffold с `cmd/<svc>` → blocker; толстый final (logic в outputs) → blocker; чистый план → 0.
- **note:** «scaffold-feasibility» знает выход `scaffold.sh` — держать в одном месте (мета-T10: derive/sync, не хардкод).

### T07 — mills/design: config-flag / untraced-knob правила
```yaml
id: 07
type: skill
blocked_by: []          # внешне: после merge PR #39 (c912461 правит requirements-intake §7)
inputs:  [skills/lib/program-design/reference/step-07-infrastructure.md, skills/lib/requirements-intake/SKILL.md]
outputs: [skills/lib/program-design/reference/step-07-infrastructure.md, skills/lib/requirements-intake/SKILL.md]
```
- [ ] step-07: config-флаги грузятся+валидируются на boot; флаг из `Deps` без записи в config-dictionary = untraced knob; неразрешённая политика = **open question оператору**, не кноб
- [ ] requirements-intake §7: поведенческий флаг — обязательно объявленное config-поле (range+default+`CONFIG_INVALID`); инъекция через `Deps` без записи = нарушение
- [ ] mills/design-rule: дизайн **не закрывает** FRD open-question сам (run08: EmptyPolicy материализовал 'empty store semantics')
- **verify:** `node harness/gen-skill-index.mjs --check` + `bash harness/smoke/run.sh` PASS. **blocked_by:** PR #39 merged (общий §7-контекст в requirements-intake)
- **realizes:** L130, L131

### T08 — mills plan-review.md durability (зеркало T02+T04 для review-артефакта)
Обнаружено на **живом прогоне poka-yoke (07-07)**: mills проверил план (вердикт OK в decisions.log, 7/7
валидаторов), но **не записал файл** `.agent/plan-reviewer/plan-review.md`. `--hard` guardrail требует этот
файл для @implementer (`rational-guardrail.ts:174`: `!exists(review)||!exists(gate1)`) → блок @scaffolder
после Gate #1. izi **не знал авто-фикса** → спросил оператора (потеря ~15 мин + ручной ответ). Причина —
тот же класс, что poka-yoke: **reply-вердикт ≠ durable-артефакт**; mills дропнул файл (на переделегации
записал). Две слабости → две правки, обе манифест-текст (как T02/T04), разные файлы → без конфликта.

```yaml
id: 08
type: role-manifest
blocked_by: []          # независим; лечь на feat/outputs-poka-yoke (T08b снова правит izi.md → бандл)
inputs:  [harness/agents/_shared/mills.md, harness/agents/_shared/izi.md]
outputs: [harness/agents/_shared/{mills,izi}.md, harness/agents/{claude,codex,opencode}/{mills,izi}.md, skills/roles/{mills,izi}/*, harness/instructions/AGENTS.codex.md]
```
- [ ] **T08a (producer, как T02):** `mills.md` — рамка «`plan-review.md` — durable completion signal, НЕ вердикт-строка; `--hard` guardrail блокирует @implementer без него; пиши файл **финальным действием** (Write, один раз), до возврата вердикта izi». Сейчас файл в `outputs:`+секция «## Output», но не оформлен как «сигнал, не reply» → дроп.
- [ ] **T08b (recovery, как T04 genchi-genbutsu):** `izi.md` — блок guardrail «требует `plan-review.md`» **И** в decisions.log есть запись mills (ревью было) → **авто-переделегировать @mills** записать файл, затем продолжить; **не** стопориться, **не** спрашивать оператора.
- [ ] **T08c (опц.):** сообщение guardrail при блоке — «`plan-review.md` отсутствует → переrun @mills» (recovery очевиден и без T08b).
- **verify:** `gen-agents --check` + `bash harness/smoke/run.sh` PASS. Живьём — mills надёжно пишет файл; izi не спрашивает оператора на дропнутом review.
- **discovered:** живой прогон 07-07 (poka-yoke chain). Матрица: producer пишет надёжно (T02 тикеты / **T08a** review) × izi чинит дроп (T04 тикеты / **T08b** review).

### T09 — сторож живого прогона: авто-resume на 504 (СДЕЛАНО, bench-тулза)
Обнаружено на живом прогоне: провайдер (OpenRouter→апстрим) отдал `504 Upstream idle timeout` → стрим
izi (GLM-4.7-flash) упал, izi встал ~19 мин, авто-ретрая нет. Лечили ручным нуджем.
- [x] `experiments/token-bench/runners/watch-izi-resume.sh` — на свежий stream-error в `opencode.log`
  спит 60с (апстрим оклемается) и будит izi одним нуджем (durable-progress не переделывает готовое).
  Безопасно: триггер ТОЛЬКО по ошибке в логе + не нуджит при видимом permission-промпте + антидребезг 90с
  → Gate #1/permission не трогает. Untracked bench-тулза (не устанавливаемый `harness/`).
- [ ] _(опц.)_ перенести retry на уровень прокси (:4000) — прозрачный ретрай апстрим-504 до возврата в
  opencode; izi ошибку не видит вовсе. Тяжелее (правка `tokenprox`), но «настоящий» фикс.

### T10 — консистентность scaffold-контракта: outputs ↔ scaffold.sh ↔ poka-yoke ↔ validate-layout ↔ izi
Обнаружено на **живом прогоне poka-yoke (07-07)**, первое живое срабатывание T03: ticketer положил
`cmd/services-by-platform/main.go` в `outputs` **scaffold-тикета (01)**. Но `harness/scaffold.sh` делает
простую детерминированную задачу — clone шаблона + rename **go-module** (`OLDMOD→SVC` во всех .go/go.mod),
**директорию `cmd/app` НЕ переименовывает** (шаблон = `cmd/app/`); scaffolder манифестом обязан «не трогать
шаблон, доверять scaffold.sh». → фактический выход `cmd/app/main.go` ≠ объявленный `cmd/services-by-platform/`
→ poka-yoke справедливо заблокировал маркер ticket-01. **Причина — постановка ticketer**, не дефект scaffolder.
Модель: scaffolder = generic-скелет (`cmd/app`); slice-переименование `cmd/app→cmd/<slug>` — работа
**следующего** implementer/assembly-тикета, не scaffold.
**Инвариант (общий, не только scaffold):** для ЛЮБОГО тикета `outputs` = **ровно те файлы, что реально
производит роль тикета**. Именно `outputs` сверяет poka-yoke (T03) на записи маркера, и на них же izi
advance'ит. Расходятся с фактом → маркер блокируется. Значит `outputs` нельзя выдумывать — их выводят из
детерминированного производителя.

**Кто что делает и как принимают (свести явно):**
| Звено | Роль/механизм | Контракт |
|---|---|---|
| **производит** | `scaffolder` → `sh harness/scaffold.sh <slug>` | clone шаблона + rename **go-module** во всех `.go`/`go.mod` + `go build`. **`cmd/app` НЕ трогает.** scaffolder манифестом «не читать/не менять шаблон, доверять скрипту»; затем build/unit/smoke + self-append маркера (T02). |
| **объявляет** | `ticketer` → `outputs:` ticket-01 | ДОЛЖНО = выход `scaffold.sh`. Сейчас **выдумывает** `cmd/<svc>` → рассинхрон. |
| **сверяет наличие** | плагин poka-yoke (T03) | на маркере: каждый путь `outputs` существует+непуст. |
| **сверяет размещение** | izi → `validate-layout.mjs` | slice-aligned: код в `internal/<slug>/`, нет layer-keyed корней. `cmd/app` не трогает. |
| **advance'ит** | `izi` (T04) | маркер в `done.log` **И** `validate-layout` чист → следующий тикет. |

**Принцип scaffolder (решает выбор):** scaffolder ставит **генерик-леса** — шаблон + свежий module-path,
чтобы проект собирался — и **проверяет пригодность к разработке** (build/unit/smoke). Он **НЕ формирует код
под слайс**: slice-идентичность живёт в `internal/<slug>/`, не в `cmd/`. Значит `cmd/app` **остаётся как есть**.

**Фикс = вариант A (принято).**
- [x] **Решение: A.** ticketer объявляет `cmd/app/main.go` как есть, rename НЕТ — `cmd/app` валидная конвенция
  (slice-идентичность в `internal/<slug>/`, не в имени бинаря). Реализовано в `wirth-ticketer.md` (`c125cda`).
- [ ] **Правило ticketer (обязательно, реализовано):** `outputs` scaffold-тикета = выход `scaffold.sh`/шаблона,
  не выдумываются. Общее: `outputs` любого тикета = что его роль детерминированно пишет.
- ~~**B:** `scaffold.sh` сам `mv cmd/app → cmd/<slug>`~~ — **ОТКЛОНЁН по принципу:** scaffolder/скрипт не формируют
  код под слайс, только ставят леса + проверяют. `mv` под slug = slice-работа, не его.
- ~~**C:** rename делает later-тикет~~ — не нужен: `cmd/app` не переименовывается вовсе.
- **verify:** scaffold на bench → `outputs` ticket-01 (`cmd/app/main.go`) == факт == poka-yoke green без ручного фикса.
- **discovered:** живой прогон 07-07 — T03 поймал ровно класс «объявленный `outputs` ≠ выход роли»: подтверждает
  ценность poka-yoke И вскрывает постановочный рассинхрон ticketer↔scaffold.sh.

### T11 — (переоформлен) генерацию скелетов ОТКЛОНИЛИ в пользу T06-валидаторов
Была идея: детерминированный генератор скелетов DoD per тип (`GenTickets`), LLM заполняет только слоты.
**Отклонена по критике** — генерация покупает «идеальный happy-path» ценой:
- **систематической ошибки:** кривой шаблон = стабильно-неверные тикеты во ВСЕХ прогонах (незаметно, всё согласованно) —
  хуже, чем LLM-выброс, который гейт ловит как аномалию;
- **заёмного детерминизма:** входы (`module-tree.md` LLM-проза, выход `scaffold.sh`) надо парсить — та же хрупкость
  (ловили в Волне 0 на code-fence); проблему двигаем на слой вниз;
- **overfit/lock-in** на Go-API-шаблон (другой стек → форк скелетов/`ProbeScaffold`/io-роутера);
- автоматизируем **лёгкую** половину (форма/пути), а дизайн живёт в **слотах** (остаются на LLM);
- не проверить, что генератор ПРАВ (сверять не с чем — тикеты прогона были багнутые).

**Решение: гейтить, а не генерить → см. `T06` (feasibility-валидаторы).** LLM пишет тикет, валидатор ловит
инвариант-ошибки на Gate #1 (биекция · scaffold-outputs==scaffold.sh · module⊆tree · тонкий final). `validate`
безопаснее `generate` (кривой валидатор = пропуск, не порча), меньше парсинга, стек-агностик, по грани проекта.
- [ ] _(опц., позже)_ **генерить ТОЛЬКО scaffold-тикет** — единственный 100% фиксированный (всегда выход
  `scaffold.sh`); остальное — валидировать (T06). Компромисс: генерация там, где нет семантики.
- **discovered:** прогон 07-07/2 — ошибки закрытия были ticketer-feasibility (scaffold просил невыполнимое, final
  перегружен). Лечится дешевле валидаторами (T06), чем генератором.
