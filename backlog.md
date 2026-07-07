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

### T06 — валидатор биекции module-tree ↔ тикеты
```yaml
id: 06
type: harness-validator
blocked_by: []
inputs:  [harness/validate-plan.mjs, harness/lib/validators.mjs]
outputs: [harness/validate-plan.mjs, harness/lib/validators.mjs]
```
- [ ] узел module-tree без тикета **ИЛИ** тикет на >1 узел = blocker на Gate #1 (биекция 1:1)
- **verify:** `node --test harness/test/validators.test.mjs` — синтетика: узел-сирота → blocker; тикет-монстр (>1 узел) → blocker; чистый план → 0
- **realizes:** «Валидатор биекции» (секция «Детерминированный генератор тикетов»)

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
