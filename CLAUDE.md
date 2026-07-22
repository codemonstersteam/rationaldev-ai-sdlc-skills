# CLAUDE.md — Контекст проекта для агента

## Проект

**rationaldev** — AI-first рациональный SDLC на базе агентов «izi» — дерзкая разработка с ИИ.
Команда = человек + машина. Только CI + канареечные релизы (нет тестовых сред). Концепция —
`CONCEPT.md`, правила — `AGENTS.md`, процесс — `docs/00_PROCESS.md`.

## Принятые решения

- **Одна ось — вес по SemVer 2.0.0.** Пять вертикалей: `greenfield | patch | minor | major | chore`.
  Решающий тест — **обратная совместимость документированного контракта**
  (`harness/agents/_shared/wirth-triage.md`); `izi` роутит по вердикту механически.
  Маршрутов `rework-*` и `foreign` **нет**.
- **Только native-репозитории.** Харнес ведёт репозитории, которые построил сам (замороженный
  контракт + дизайн-пакет + своя парадигма тестов). Роли `surveyor`/`foreign-designer`, скилл
  `conform-tests` и вся разведочная/conform-механика **удалены**.
- **Роли (izi-имена):** `izi`=Witt (роутер), `gilb`=Gilb, `wirth-*`/`change-intake`/`scaffolder`=Wirth,
  `dijkstra`=Dijkstra, `mills`=Mills, `hughes`/`hughes-rework`=Hughes, `linger`=Linger, `fagan`=Fagan,
  `git-hand`=Torvalds, **`ledger`=Rochkind**, `michtom`=Michtom. Набор закрыт.
- **Human Gates — три:** #1 акцепт плана (`GATE1 APPROVE`), #2 мерж (`GATE2 APPROVE` → маркер
  `.agent/gates/gate2.approved`), #3 приёмка прод-релиза после канарейки. Маркеры ставит только гардрейл.
- **RUN-CLOSE (`@ledger` → `harness/close-run.mjs`):** пруф мерджа → тег на транке
  (`ci/semver-bump.mjs`) → запись в `docs/changes/LEDGER.md` → атомарный вайп `.agent/`.
  Бампы: greenfield→`1.0.0`, patch→`Z+1`, minor→`Y+1.0`, major→`X+1.0.0`, chore→**no-bump**.
  Форма тега — от последнего релизного тега репо; тегов нет → дефолт `v` (`DEFAULT_PREFIX`).
  Тег ставит **только** `@ledger`; `ci/recipes/*` — образец для репо без харнеса, в `template/` не кладётся.
- **minor:** аддитивность механически (`node harness/validate-contract-diff.mjs --require-additive`;
  breaking ⇒ exit 2 ⇒ ре-триаж как `major`) + новая способность за тогглом **default OFF**.
- **Нет тестовых сред.** Деплой — канарейкой за фиче-тогглом прямо в прод на вариативные
  среды (VM/контейнер/serverless, не обязательно k8s). Мониторинг — 4 золотых сигнала.
- **Тесты:** юниты по формуле + компонентные + контрактные (`pinout`); корректность модулей —
  математической композицией (`program-design`). Безопасность — на планировании + security-scan в CI.
- **Фундамент:** труды Wirth / Hughes & Michtom / Linger, Mills, Witt + статьи автора.

## Статус

Харнес переведён на SemVer-вертикали (ветка `feat/semver-verticals`), 254 теста зелёные.

| Артефакт | Статус |
|---|---|
| Роли: `ledger`, `wirth-triage` (SemVer), `change-intake`, `git-hand`, `izi` (5 лейнов) | ✅ |
| `harness/close-run.mjs`, `ci/semver-bump.mjs`, `ci/recipes/*` | ✅ |
| `requirements/semver-verticals.md` (FRD, открытых вопросов нет) | ✅ |
| `docs/flows/{greenfield,patch,minor,major,chore}-flow.md` | ✅ |
| `CONCEPT`, `README`, `GLOSSARY`, `docs/00_PROCESS`, `01_DIAGRAM`, `harness-flow`, `05_REPO_STRUCTURE` | ✅ под вертикали |
| Удалено: `surveyor`, `foreign-designer`, `conform-tests`, маршруты `rework-*`/`foreign` | ✅ |
| `docs/SDLC.svg` (веер весов + бампы), `presentation/sdlc.html` (9 слайдов) | ✅ под вертикали |
| `docs/features/rework-workflow.md`, `docs/concept-api-workflow.md`, `docs/04_PLANNING_PIPELINE.md` | 🟡 исторические, помечены/не переписаны |

## Следующий шаг

Живой прогон `opencode --agent izi` по вертикалям patch/minor (стенд — `/tmp/pinout-semver-test`,
origin `max0l0gy/pinout-semver-test`, тег `v0.0.1` уже стоит): проверен механический контур, но не
поведение ролей. При желании — переписать `docs/concept-api-workflow.md` (граф ролей устарел).

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
