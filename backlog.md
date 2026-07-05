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
