# Backlog — rationaldev (мета-репо SDLC)

Дорожная карта **самого репозитория** (методология AI-first рационального SDLC, агенты izi).
Не путать с шаблоном разработки сервиса — он в [`template/backlog.tmpl.md`](template/backlog.tmpl.md).
Поток работы — Trunk Based Development: ветка живёт 1–2 дня, один PR в `main` за шаг (`AGENTS.md`).

## Todo

### Унификация скиллов и манифестов ролей (DRY, single source of truth)
Снять тройной дрейф идентичности роли и два формата скиллов. Эпик-первопричина —
одна сущность размазана по 2–3 файлам в 2–3 синтаксисах. Порядок по ROI: A → B → D → C → E.

- [x] **A · P0 — единый источник правды роли.** Идентичность роли свёрнута в frontmatter
  `harness/agents/_shared/<role>.md` (`role/izi/tier/mode/temperature/steps/step/gates/
  inputs/outputs/skills/permission/description`), перенеся туда хардкод `META` из
  `gen-agents.mjs` и поля из `skills/roles/`. Генератор читает frontmatter, а не `META`.
  Решить судьбу `skills/roles/`: удалить или **генерировать** из того же источника.
  _DoD:_ `META` в `gen-agents.mjs` пуст; правка роли — в одном файле; проекции
  claude/opencode/codex перегенерируются; `skills/roles/` не правится руками.
- [x] **B · P0 — единый формат скиллов.** 4 плоских доменных скилла переведены в
  `skills/lib/<name>/SKILL.md` + frontmatter (`name`, `description` когда/когда-НЕ,
  `version`). Побочно починен баг: `install.sh` линкует только `<dir>/SKILL.md`, т.е.
  плоские скиллы вообще не устанавливались. Все 17 скиллов теперь единого формата.
- [x] **D · P0 — реестр скиллов + CI-инвариант.** `harness/gen-skill-index.mjs` генерирует
  `skills/INDEX.json` (`name/path/version/status/description` + карта роль→скиллы) из
  frontmatter и валидирует: каждый скилл из `skills:` роли существует и `stable`; `name`
  скилла == имя каталога. Битая ссылка → `exit 1`. Проверка `--check` встроена в smoke
  (PASS 21). Парсер frontmatter вынесен в общий `harness/frontmatter.mjs` (DRY).
  _Осталось:_ (2) `outputs[N] ⊇ inputs[N+1]` — требует структурных `inputs/outputs` в
  ролях, вынесено в отдельный пункт ниже.
- [ ] **D2 · P1 — целостность пайплайна.** Добавить `inputs/outputs` в frontmatter ролей
  и проверку `outputs` роли N ⊇ `inputs` роли N+1 («роль = модуль» машинно). Сейчас
  вход/выход описаны прозой в теле роли.
- [x] **C · P1 — progressive disclosure для `program-design`.** `SKILL.md` 1053 → 111 строк:
  голова + Step-индекс + навигация + сводка жёстких правил/STOP (conformance-gate) + DoD.
  Тело каждого из 12 шагов вынесено в `reference/step-NN-*.md` (механический split, контент
  байт-в-байт, 992 строки сверены). `install.sh` симлинкует каталог скилла целиком — reference
  доезжает до раннера. smoke PASS 21.
- [x] **E · P2 — единая адресация скиллов по имени.** Манифесты ролей уже без путей (с A2,
  генерятся из `_shared`). Доведено: скилл→скилл ссылки `skills/<name>/SKILL.md` нормализованы
  в имена (`program-design`, `component-tests`, `program-implementation`) в program-implementation
  и reference-файлах program-design; проза plan.md обновлена. Один механизм: скилл резолвится
  по имени, путей в ссылках нет.

### Инфраструктура репозитория
- [ ] Сверить сквозные номера версий доков/скиллов (часть осталась `v1.0`, observability — `v2.0`)
- [ ] `docs/02_MEASUREMENT.md §2.4` — переименовать «Платформа данных / Аналитика-отчётность» → «Отчётность» (analytics как роль убран)

### Скиллы из `SKILLS-BACKLOG.md` (детерминированные процедуры)
Очередь и DoD — в [`SKILLS-BACKLOG.md`](SKILLS-BACKLOG.md). Кратко по приоритету:
- [ ] **P0** `canary-release` — выкат канарейкой за тогглом на вариативную среду (роль Michtom)
- [ ] **P0** `release-health-analysis` — 4 золотых сигнала + вердикт GREEN/YELLOW/RED (роль Michtom)
- [ ] **P0** `security-ci` — security-scan в CI, «секрет в коде = блок мержа» (роль Linger)
- [ ] **P0** `contract-tests` — довести черновик `skills/lib/contract-tests/` до полной процедуры (проверка через `pinout`)
- [ ] **P0** `error-classification` — план vs реализация vs конфиг (роли Linger, Witt)
- [ ] **P1** правила безопасной разработки — вшить в `program-design` / `program-implementation`
- [ ] **P2** `agent-ready-gate`, `epic-decomposition` (роль Witt)
- [ ] **P3 (опц., только под нагрузку)** `load-capacity`, `high-availability`

### Согласованность методологии
- [ ] Прогнать `doc-quality-review` по обновлённым ролям и `skills/lib/observability/SKILL.md`
- [ ] Проверить, что все манифесты ролей ссылаются только на существующие скиллы (после удаления tech-radar/qa/analytics)

## Done

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
