# Backlog — rationaldev (мета-репо SDLC)

Дорожная карта **самого репозитория** (методология AI-first рационального SDLC, агенты izi).
Не путать с шаблоном разработки сервиса — он в [`template/backlog.tmpl.md`](template/backlog.tmpl.md).
Поток работы — Trunk Based Development: ветка живёт 1–2 дня, один PR в `main` за шаг (`AGENTS.md`).

## Todo

### Инфраструктура репозитория
- [ ] Первый коммит и публикация на GitHub (`codemonstersteam/rationaldev-ai-sdlc-skills`)
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
- [ ] Прогнать `doc-quality-review` по обновлённым ролям и `skills/lib/observability.md`
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
