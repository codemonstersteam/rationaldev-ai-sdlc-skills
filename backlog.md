# Backlog — rationaldev (мета-репо SDLC)

Дорожная карта **самого репозитория** (методология AI-first рационального SDLC, агенты izi).
Не путать с шаблоном разработки сервиса — он в [`template/backlog.tmpl.md`](template/backlog.tmpl.md).
Поток работы — Trunk Based Development: ветка живёт 1–2 дня, один PR в `main` за шаг (`AGENTS.md`).

## Todo

> Унификация скиллов/ролей (DRY: A, A2, B, C, D, D2, E) — **завершена**, см. Done.

### Landed (сессия 14-07)
- [x] **ADR перенесён в дизайн-фазу — `@wirth-moduledesigner` = PRIMARY ADR-автор (обязательный шаг).**
  Наблюдение: труднообратимые/неочевидные архитектурные решения ПРИНИМАЮТСЯ в дизайне (Parnas-границы,
  io-router, «вердикт не ошибка пайпа», valid-by-construction), а ADR-авторство висело на `@hughes`/`@linger`
  (имплементация/фиксы) — перевёрнуто. moduledesigner уже грузит `domain-modeling` (ADR-FORMAT) → на один шаг
  от записи. Фикс: обязательный ADR-шаг в moduledesigner (three-condition, sparingly, `docs/design/slice-<slug>/adr/`);
  hughes/linger — только редкий fix-time ADR. Лестница README `@dijkstra` теперь ведёт в живые ADR, «почему»
  не теряется в `.agent/decisions.log`. Сверено: таблица авторов в `domain-modeling` Ф-табле.

### Landed (сессия 12-07, ветка feat/gilb-frontdoor)
- [x] **Фронтдор — механический poka-yoke.** Проза в izi.md не держит (модель 2× проскочила @gilb → триаж);
  инвариант «пока нет `.agent/planner/brd.md`, единственная разрешённая делегация — @gilb» унесён в хук
  (`requiresFrontDoor` в `shared.mjs`, claude+opencode). Подтверждён вживую: izi заблокирован → сам ушёл в @gilb.
- [x] **gate-approve — акцепт только когда план готов.** Баг: операторское «go ahead» на ранней фазе ложно
  ставило `gate1.approved` за час до плана (обнуляло человеческий Gate #1). Фикс: `planReadyForApproval`
  (`shared.mjs`) — маркер ставится ТОЛЬКО при наличии `PLAN.md`/`plan-review.md`. Claude+opencode, смоук 17/17.
- [x] **Модели — две тира opus+sonnet (claude).** opus только для суждения, отравляющего downstream
  (gilb/intake/apidesigner/moduledesigner/mills); всё остальное sonnet (исполнение по готовому входу).
  hughes: `tier small→medium` (имплементер = не мех-работа, sonnet-пол корректности кода).

### Доработки харнеса (из прогона 13-07, TODO)
- [x] **ticketer: объявлять КОНТЕНТНЫЙ скилл в шапке тикета, не только io-router.** ✅ Сделано (фикс run 13-07).
  Реализовано в `implementation-ticket-writer` §«Content skill — by ARTIFACT discipline»: контентный скилл
  роутится по **выходному артефакту** тикета — doc/README → `documentation` (+`md-formatting`), MUST;
  `validate-tickets` **hard-блокирует** doc-производящий тикет без `documentation` (poka-yoke). Content-скиллы
  ортогональны io-роутеру (стрипаются перед io-equality). Недетерминизм ticket-10 закрыт.
  _Осознанное решение:_ `program-implementation` для код-модулей **НЕ листится** — это **Core (always)** hughes
  (`hughes.md`: Core = program-implementation/code-style/communication/memory), грузится по построению; листинг = шум.
  _ADR не трогаем:_ ADR — не выход тикета, его пишет `wirth-moduledesigner` в дизайн-фазе (#45) с `domain-modeling`;
  роутить нечего.

### Brownfield-режим — доработка СУЩЕСТВУЮЩЕГО API (из анализа 16-07)
Конвейер greenfield-first: на задаче «доработать API» apidesigner пере-замораживает контракт, но существующий
контракт **не является входом**, а `validate-contract-frozen` проверяет лишь наличие `x-frozen` — не диффит против
прошлой версии. Итог: (а) регенерация может **потерять эндпоинты/схемы**, не переописанные в этом прогоне;
(б) тихую **ломающую** правку конвейер не остановит («breaking = new major» — принцип в голове apidesigner, не гейт).
- [ ] **Прошлый контракт — вход `wirth-apidesigner`.** Если `api-specification/openapi.yaml` (или `config/report.schema.json`)
  уже существует и `x-frozen` — читать его и **эволюционировать совместимо** (сохранить поверхность, добавлять/менять
  только по задаче), а не регенерить из одних use-cases. Объявить существующий контракт входом в манифесте роли.
- [ ] **Дифф-гейт против прошлой версии на Gate #1.** Механическая проверка «новый контракт vs прошлая замороженная
  версия» → пометить breaking (removed/type-drift/новое required). Переиспользовать `oasdiff` / сам **pinout**
  (reverse), а не изобретать: прогон `pinout` (forward+reverse) в CI харнеса закрывает детект «кого сломает».
- [ ] **Brownfield-осознанность в ролях** (triage/intake/slicer): различать «новый сервис» vs «доработка существующего»,
  подтягивать текущие спеку/README/тесты как контекст. Сейчас единственное «existing» (usecase) — про цель из FRD, не про контракт.
_MUST:_ дифф-гейт — advisory на Gate #1 (не жёсткий блок реализации), чтобы намеренный major проходил осознанно.

### Перевод скиллов на английский (i18n) — оптимум, не минимум
Цель: все `skills/lib/*` на английском, лаконичные, без потери сути; tier-agnostic (GLM…Opus).
Статус (16-07, пересчёт): **тело переведено у всех 33** — Фаза 1 завершена. Остаётся только Фаза 3 (литералы) и опц. Фаза 2 (тест):
- **`domain-modeling`** ✅ — был почти EN (не RU-скелет, как ошибочно в прошлом статусе); 2 RU-фрагмента переведены. Метки `Ф0/Ф1–Ф3` оставлены как cross-ref на RU-feature-док `domain-context-adr-layout.md` (перевести, когда док станет EN).
- **Фаза 3 — framing:** ✅ влито (PR #47) — все пины моделей/`weak model` → tier-agnostic (`weaker tiers`/`small-tier-sized`), скан `skills/lib` чист.
- **Фаза 3 — литералы:** остаточные RU-строки в `architecture`(4), `component-tests`(4), `observability`(2),
  `program-implementation`(5), `requirements-intake`(3) + намеренные RU-артефакты (`git-conventions` коммит-примеры,
  `security` секции `## Безопасность` в plan.md) + `Ф`-метки domain-modeling — решить по `I18N.md` (перевод только когда писатель И читатель EN);
- **Фаза 2 — тест** переведённого (семантический дифф + golden A/B на целевых моделях) — по мере надобности.

**Раскладка тиров (упоминать в релевантных скиллах) — tier-agnostic текст, но факт claude-раскладки:**
две тира — `opus` (суждение: gilb/intake/apidesigner/moduledesigner/mills) · `sonnet` (всё исполнение,
включая имплементер/тестировщик/скаффолдер/роутер). haiku убран (пол корректности = sonnet). На opencode-
бенче тиры иные (large=GLM · medium/small=Qwen) — раскладка per-runtime в `harness/models.config.json`.

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
- [x] ~~**Разгрузить final:** вынести wiring/config/observability из `final` в свои module-тикеты~~ —
  **закрыто T12 (split-final, влит в main).** «Final»-помойки больше нет: слайс замыкается шагами
  `wiring` + `README` (тонкие module-тикеты) + `@fagan` DoD-closure. Подтверждено run 08-07/3-harnes
  (0 retry на финале). Пункт мёртв.

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

### Deliverable shapes — двухуровневая модель (pipeline = vertical slice + target-profile внутри)
**Уровни (не конкуренты — разные слои):**
- **PIPELINE = vertical slice по ДИСЦИПЛИНЕ** (go-backend · prototype · flutter-ui · …). izi/triage: KIND → выбрать пайплайн (композицию стадий). Верхний уровень.
- **target-profile = кноб near-sibling-вариации ВНУТРИ пайплайна** (go-backend: shape ∈ {service, cli} — 4 края: контракт · ingress · шаблон · DoD/ctest).
- **ROLES + SKILLS = общая библиотека** — оба уровня переиспользуют.

**go-backend / cli (near-sibling через target-profile):**
- [x] ~~**Ф0** research CLI best-practices~~ — сделано (заметка для cli-io).
- [x] ~~**Ф1** `template-go-cli` fillable-скелет~~ — собран (образец паттерна в скилле, не в коде).
- [x] ~~**Ф1a** опубликовать `template-go-cli` на GitHub~~ — `codemonstersteam/template-go-cli` (PRIVATE).
- [x] ~~**Ф2** sub-skill `cli-io`~~ — создан (driving adapter / Ports&Adapters).
- [x] ~~**Ф3-NEW** target-profiles.json + skill + validate-dod/contract-frozen/scaffold делегируют профилю~~ — сделано.
- [x] ~~**Ф3-B** ролевые правки «делегируй профилю»~~ — сделано; прогон pinout-openapi подтвердил CLI-путь (target=cli, контракт=config+report schema, http-io только на реальном outbound).
- [ ] **Ф3-C** (трения из боевого прогона pinout, 12-07):
  - **io-router/validate-tickets не знает `cli-io` как ingress-скилл** — заблокировал `skills=[cli-io]` в шапке cli-ingress-тикета (io:none → skills=[] строго). Ticketer обошёл «body-guidance», но @hughes не подхватит cli-io через шапку. Фикс: допустить `cli-io` (и ingress-адаптеры вообще) для ingress-модуля в io-router + validate-tickets.
  - **`cmd/app/` vs `cmd/tool/`** — validate-plan poka-yoke форсит `cmd/app/` (сервис), а `template-go-cli` кладёт `cmd/tool/`. Мисматч ломает scaffold/wiring. Фикс: cmd-каталог из профиля (service→`cmd/app`, cli→`cmd/<tool>`) в target-profiles.json + validate-plan.
  - (мелко) DoD-closure-гейт скипнулся: TASK §DoD — буллеты, не нумерованные. Апстрим-формат TASK, не дефект.

**Level 1 — PIPELINE как первоклассное понятие (future, prereq для не-go-backend):**
- [ ] Поднять «pipeline» в first-class: `harness/pipelines.json` (KIND → список стадий) · `triage`/`gilb` классифицируют **вид** дисциплины → izi исполняет выбранный пайплайн (сейчас — один захардкоженный modular-путь).
- [ ] **prototype pipeline** — кликабельный мок (Vite/static), лёгкая дисциплина: gilb → (лёгкий intake) → wireframe/clickable → операторская приёмка. Переиспользует `gilb`. Нет frozen-контракта / module-tree / godog.
- [ ] **flutter-ui pipeline** — Dart/widget-дисциплина: intake(UI) → screen/flow → widget-tree → state (BLoC) → widget-tests → сборка. Переиспользует `gilb`/`mills`/`fagan`/`linger` + новые стадии/скиллы (`flutter-scaffold`, widget-io). Потребляет API, не отдаёт.

### Gilb — фронтдор требований (БТ → BRD), НОВАЯ РОЛЬ
Точка входа конвейера **до** planner. Пользователь грузит сырое **БТ** → `izi` доводит его до
измеримого **BRD** (через @gilb) и роутит в нужный конвейер по размеру задачи. Имя — Tom Gilb
(*Software Metrics* 1976, *Principles of SE Management* 1988, Planguage): **«требование не измеримо
— не готово»**; перекликается с Fagan через *Software Inspection* (1993).

**Мотив:** в run08/3-harnes диапазоны полей выдумывались на дизайне, т.к. требования приходили
неполными. Фронтдор гарантирует полноту BRD **на входе**, а не латает на Gate #1.

```yaml
role: gilb            # tier: large (глубокий анализ), temp: 0.1
skills: [requirements-intake]        # data-dictionary §7, actors/UC, failure-map
stage: 0              # ДО wirth-intake (тот делает BRD→FRD; Gilb делает БТ→BRD)
```

**Как работает — @gilb думает, izi посредник диалога** (только izi говорит с оператором; субагент
headless depth-1, интервью с юзером вести не может):
- [ ] `izi` получает БТ → делегирует `@gilb`: читает БТ → **черновик BRD + список ВОПРОСОВ** (пробелы,
  диапазоны/enum/format полей, open-questions). **Сам ответы НЕ выдумывает** (run08-урок) — неразрешённое
  → вопрос оператору.
- [ ] `izi` показывает вопросы оператору **пачкой**, собирает ответы, скармливает обратно `@gilb` →
  тот дошивает BRD. Петля 1-2 раунда, замыкается на **agent-ready** (`@gilb` рапортует «open-questions=0,
  BRD измерим»).
- [ ] готовый BRD (data-dictionary: range/enum/format каждого поля · failure-map · контрактные предпосылки)
  = **вход для `wirth-*`** пайплайна.

**Роутинг по размеру** (после готового BRD, делает izi):
- [ ] 1 эндпоинт / 1 слайс → текущий API-конвейер (`wirth-*` → … → `@fagan`);
- [ ] много слайсов / эпик → сначала `epic-decomposition` → API-конвейер по каждому.

**Интеграция (как для @fagan — иначе роль полу-подключена):**
- [ ] `harness/agents/_shared/gilb.md` (ядро «What you are» на якорях: измеримость, Planguage, agent-ready)
- [ ] `gen-agents.mjs` ORDER: `gilb` первым (stage 0) · guardrail `PIPELINE` +`gilb`
- [ ] `izi.md`: точка входа — приём БТ → делегация `@gilb` → посредничество Q&A → роутинг по размеру
- [ ] `models.config.json`: `gilb` наследует tier large → GLM (override не нужен)
- [ ] `gen-agents` перегенерация проекций

**Развилка (решить при заводе):** прожарка-петля по вопросам **пачкой** (izi показывает список, ответ
пачкой — меньше раундов) vs **по одному** (AskUserQuestion-стиль). Дефолт — пачкой.

**Реализует backlog-пункты:** `agent-ready-gate` (BRD готов?), `epic-decomposition` (раскрой эпика).
Связано: [L130/L131 untraced-knob], `requirements-intake §7`, TASK.md data-dictionary.

### @fagan — усилить вердикт на стейл-комменты (находка run 08-07/3-harnes)
- [ ] **«Зелёный код с текстом ‘не готово’ = reject».** В прогоне в `.feature` остался коммент
  «сервис не реализован (placeholder 501)» при зелёном сервисе — `@fagan` не поймал, всё равно принял.
  Механика (в `validate-dod.mjs`): grep доставленных артефактов (README/`*.feature`/docs) на маркеры
  незавершённости (`placeholder`/`not implemented`/`не реализован`/`TODO`/`FIXME`/`501`/`WIP`/`заглушка`)
  → вернуть подозрительные строки. Семантика (`fagan.md` Move 2): по каждой строке решить — противоречит
  ли она зелёному состоянию (`placeholder 501` при работающем сервисе → reject; честный tech-debt «TODO:
  кэш потом» → ок). Делёж: grep ловит слова (дёшево), `@fagan` судит «врёт/честно» (смысл).

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

### T09b — 504-resilience ЧАСТЬЮ плагина `rational-guardrail` (в проработку)
Заменить tmux-сайдкар (`watch-izi-resume.sh`) встроенной в плагин 504-устойчивостью: ставится автоматом
с `--hard`, работает in-process (без хрупкой TUI-автоматики: QUEUED/Escape). Выбрано вместо proxy/config-ретрая.
- **Проработка (открытый вопрос):** есть ли в Plugin API OpenCode хук на **stream-error / session-error / retry**?
  `rational-guardrail` сейчас использует только `tool.execute.before/after`. Нужно найти хук уровня чата/сессии.
- [ ] исследовать Plugin API OpenCode: перечислить доступные хуки (chat/session/error/stream).
- [ ] если хук есть → плагин ловит провайдерский stream-error → **авто-retry запроса** (in-process), izi turn
  не умирает; нудж/сайдкар не нужны. Триггер строго по ошибке (как сторож), не по idle.
- [ ] если хука НЕТ → fallback: proxy-ретрай (T09-опц выше) или `maxRetries` провайдера в `opencode.jsonc`.
- [ ] **фьюз-семантика (главное, не только «оживить»):** K=2-фьюз T04 сейчас **слеп к причине dropout** —
  считает сетевой транзиент (stream-error/504) и Qwen-флак (invalid-tool) в ОДИН счётчик → **escalate'ит
  рабочий модуль** на 2 сетевых икоты (run 07-07/3: ticket-04 FileStore эскалирован на сети, не на дефекте).
  ```
  onDropout(ticket, log):
    NET  (stream-error/504) -> retryFree     // НЕ в K=2 (сеть ≠ вина модуля)
    QWEN (invalid-tool)     -> retryCounted -> k==2 -> escalate
  ```
  T09b чинит это **by construction:** транспорт ретраит 504 ДО izi → izi видит только QWEN-dropout → K=2
  считает лишь реальные module-трудности. (Альтернатива без T09b: izi классифицирует dropout по логу —
  сложнее.) Значит T09b — не косметика, а **исправление семантики эскалейта.**
- [ ] **детект ТИХОГО hang, не только clean-error (07-07/3 ticket-09):** провайдер перестал слать данные, но
  НЕ вернул ошибку (стрим повис ~13 мин, «stream error» в лог не попал) → сторож/плагин не сработал. Триггер
  должен ловить и **staleness** («нет новых токенов N сек»), не только строку `stream error`. opencode сам
  зависший стрим не таймаутит; Escape берёт только серией.
- [ ] **cooldown не должен глушить НОВЫЙ distinct-столл (07-07/3):** 90с-антидребезг сторожа подавил legit-
  recovery ticket-09 («ошибка, но cooldown → пропуск»), т.к. cooldown тикал от прошлых срабатываний. Cooldown —
  против burst ОДНОГО столла, но новый тикет/новая сессия = сбросить.
- **deprecates:** `watch-izi-resume.sh` (bench-сайдкар) — оставить только на не-сетевой silent-idle, если плагин
  сетевое закроет.
- **verify:** инъекция 504 И тихого hang в прокси → izi turn переживает без ручного нуджа/сайдкара; K=2-фьюз НЕ
  горит на сети; cooldown не глушит новый тикет.
- **discovered:** прогоны 07-07 — 504 роняет turn izi; tmux-нудж хрупок (QUEUED); K=2-фьюз эскалейтит модуль на
  сетевом транзиенте (07-07/3 ticket-04); тихий hang на длинном final-ходе не ловится сторожем + cooldown
  подавил recovery (07-07/3 ticket-09). **Сеть — доминантный (и единственный) режим отказа прогона; код чист.**
  Место фикса — транспорт/плагин, не TUI.

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

### T12 — split-final: убрать «final»-помойку, замыкать слайс шагами конвейера
Обнаружено на **07-07/3:** thin-final (правило-проза) сделал модули тонкими, но **final всё равно сгрёб**
wiring+README+Docker+DoD в один тикет → длинный ход → систематический провайдерский idle-timeout (ticket-09
дропался ×4). **Прозой не чинится** — нужен структурный слот. Ключ: пост-модульные шаги **инвариантны** для
любого API-слайса (не суждение) → механические слоты формы, не concern'ы одного тикета.
```
closeSlice(modules 03..08) -> Gate#2:
    | wiring   -> API наружу      // register.go + main.go (включает сервис: 501 → живой эндпоинт)
    | README   -> docs            // ∥, пишется из дизайна (openapi/module-tree/use-case)
    | linger   -> замкнуто        // снять @wip + прогнать тесты (build+unit+component GREEN) + сверить DoD-1..8
    -> Gate #2
```
Docker/`compose`/`run-tests.sh` — **в scaffold** (детерминированный boilerplate, класс T10); linger их запускает, не пишет.
- [ ] **форма бэклога:** слот `final` → **`wiring` + `README`** (отдельные implementer-тикеты, как `module×N`);
  file-производящий `final` **убрать** — замыкает `linger`-приёмка (уже шаг пайплайна). Правки:
  `implementation-ticket-writer` (ordering + «Integration/final rule»), `wirth-ticketer` (dep-order + «DoD-closure
  = @linger, не тикет»), `program-design` step-11 ticket-template.
- [ ] **scaffold outputs += `Dockerfile`, `docker-compose.yml`, `run-tests.sh`** (boilerplate из шаблона; см. T10).
- [ ] **`linger.md` — явный DoD-closure:** снять @wip + build+unit+component green + сверить DoD-1..8 → Gate #2.
- [ ] **T06-чек одноконцерновость:** implementer-тикет не мешает wiring+README+Docker в `outputs`; file-производящего
  `final` нет → blocker на Gate #1.
- **механизм:** форма эмитит `wiring`/`README` отдельными слотами → ticketer пишет ТЕЛА, нарезку не решает → куча
  невозможна by construction. Каждый слот = 1 concern → короткий ход → нет idle-timeout.
- **verify:** ticketer на дизайне slice-01 → `wiring` и `README` отдельными тонкими тикетами, `final`-помойки нет.
- **поглощает:** заметку «thin-final недостаточен». Ложится на `feat/outputs-poka-yoke`.
