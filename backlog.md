# Backlog — rationaldev (мета-репо SDLC)

Дорожная карта **самого репозитория** (методология AI-first рационального SDLC, агенты izi).
Не путать с шаблоном разработки сервиса — он в [`template/backlog.tmpl.md`](template/backlog.tmpl.md).
Поток работы — Trunk Based Development: ветка живёт 1–2 дня, один PR в `main` за шаг (`AGENTS.md`).

## Todo

> Унификация скиллов/ролей (DRY: A, A2, B, C, D, D2, E) — **завершена**, см. Done.

### Инфраструктура репозитория
- [ ] Сверить сквозные номера версий доков/скиллов (часть `v1.0`, observability `v2.0`, contract-tests `0.1/draft`) — версии скиллов/ролей теперь машиночитаемы в `skills/INDEX.json`
- [ ] `docs/02_MEASUREMENT.md §2.4` — переименовать «Платформа данных / Аналитика-отчётность» → «Отчётность» (analytics как роль убран)

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
