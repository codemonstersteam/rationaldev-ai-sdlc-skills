# CLAUDE.md — Контекст проекта для агента

## Проект

**rationaldev** — AI-first рациональный SDLC на базе агентов «izi» — дерзкая разработка с ИИ.
Команда = человек + машина. Только CI + канареечные релизы (нет тестовых сред). Концепция —
`CONCEPT.md`, правила — `AGENTS.md`, процесс — `docs/00_PROCESS.md`.

## Принятые решения

- **6 ролей-агентов (izi)** с кодовыми именами инженеров: `planner`=Wirth, `plan-reviewer`=Mills,
  `implementer`=Hughes, `fixer`=Linger, `release-health`=Michtom (слияние Release+SRE),
  `orchestrator`=Witt (человек-дирижёр, honorary).
- **Нет тестовых сред.** Деплой — канарейкой за фиче-тогглом прямо в прод на вариативные
  среды (VM/контейнер/serverless, не обязательно k8s).
- **Human Gates — три:** #1 акцепт плана, #2 мерж, #3 приёмка прод-релиза после канарейки.
- **Тесты:** только компонентные + контрактные (проверяет `pinout`). Корректность модулей —
  математической композицией (`program-design`).
- **Мониторинг — 4 золотых сигнала.** Безопасность — на планировании + security-scan в CI.
- **CI использует утилиты экосистемы RRA** для валидации решений.
- **Убрано:** тестовые среды/стенды, кольца/k8s-обязательность, презентация, банковский контекст,
  скиллы `tech-radar`/`qa`; `analytics` схлопнут в продуктовую разработку (Discovery инженер+ИИ).
- **Фундамент:** труды Wirth / Hughes & Michtom / Linger, Mills, Witt + статьи автора.

## Статус

Репозиторий переработан из `rational-skills-ai` под дерзкий SDLC разработки с ИИ.

| Артефакт | Статус |
|---|---|
| README, CONCEPT | ✅ переработаны |
| Роли (6, izi-имена), `release-health` | ✅ |
| `skills/lib/observability` (4 сигнала, канарейка) | ✅ |
| `skills/lib/contract-tests` (pinout) | ✅ новый |
| SKILLS-BACKLOG (canary/security/contract/высоконагруз) | ✅ |
| GLOSSARY | ✅ |
| `docs/00_PROCESS`, `01_DIAGRAM`, `02_MEASUREMENT`, `03_REPORTING`, `get-started` | ✅ вычищены (стенд/кольца/sre/банк убраны) |
| `plan.md`, `CONTRIBUTING.md`, `docs/story/*`, `skills/lib/{security,architecture,git-conventions,code-style}` | ✅ вычищены |
| Манифесты ролей (загрузка скиллов, гейты) | ✅ выровнены (нет analytics/qa/tech-radar; гейты #1–3) |
| `docs/SDLC.svg` (заменил `.jpeg`) + `presentation/sdlc.html` | ✅ перерисованы под CI→канарейку |

## Следующий шаг

Ревью репозитория; при желании — завести GitHub-репо. Грязных маркеров
(стенд/кольца/SRE-агент/банк/удалённые скиллы) не осталось. Диаграмма (`docs/SDLC.svg`)
и презентация (`presentation/sdlc.html`) перерисованы под CI→канарейку.

## Тестовый прогон харнеса — как запускать

1. **Песочница:** `experiments/token-bench/runners/prepare-rational-sandbox.sh` — пересобирает
   `../test-harnes-rational` (идемпотентно), ставит харнес `--hard` (guardrail-плагин), модели
   large=GLM-5.2 / medium+small=Qwen3.6-27b через прокси :4000, отключает omo. Перед этим —
   `tmux kill-server` (tmux только для прогонов харнеса).
2. **Запуск (наблюдаемый через tmux):** сессия `bench-rational`, в `../test-harnes-rational`
   `export OPENROUTER_API_KEY=… && opencode --agent izi`. **Точка входа — роль `izi`** (не
   orchestrator). Операторский промпт минимальный: «Прочитай ./TASK.md и веди задачу».
3. **Вести прогон:** прокликивать только рутинные `Allow`-пермишены (доступ к `harness/lib`,
   `harness/*`). Столл субагента диагностировать по `~/.local/share/opencode/log/opencode.log`
   (`loop step`/`stream`/`llm runtime selected`), не по прокси.
4. **Gate #1 / #2 — человеческие, НЕ прокликивать.** Оператор акцептует план сам:
   `touch ../test-harnes-rational/.agent/gates/gate1.approved` — только после реальной оценки
   плана (валидаторы + вывод mills + сами артефакты). Guardrail до маркера жёстко блокирует
   @implementer.

## Тестовые прогоны харнеса — где хранить результаты

Два разных места, не путать:

- **Сырьё прогона** → `../test-harnes-data/DD-MM-YYYY/N-harnes/` (сиблинг репо, **не коммитится**,
  иммутабельно — новый прогон в свою папку, старые не трогать). Структура и пошаговая процедура —
  в `test-harnes-data/README.md`. Кладём: `agent-trace/` (из песочницы `.agent/`), `project/`
  (`rsync` снапшот без `.opencode/.agent/harness/test/.git/.env/vendor`), `proxy/` (**срез окна**:
  `jq 'select(.ts>="<старт-UTC>")'` для `usage.jsonl`+`flow.jsonl`), обязательные `models.md` и
  `analysis.md` (итог, метрики, фазовый сплит по Gate #1, сравнение с прошлым). Секрет-чек
  `grep -c 'sk-or-\|Bearer' proxy/*.jsonl` == 0.
- **Коммитимый синтез/методология** → `experiments/token-bench/*.md` (`EXPERIMENT.md` A/B-таблица,
  `RUNS.md` кросс-прогонный индекс, `RUNBOOK.md`, `spec/`). Сырые per-run дампы сюда НЕ класть.

Подготовка песочницы — `experiments/token-bench/runners/prepare-rational-sandbox.sh`; экономику
логирует token-прокси (:4000). Диагностика столла субагента — `~/.local/share/opencode/log/opencode.log`.

## Фрейм работы с агентом

> Агент: прочитай `CONCEPT.md` и `AGENTS.md` перед тем как отвечать.
