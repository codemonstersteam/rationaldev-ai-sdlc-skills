# rationaldev — AI-first рациональный SDLC (агенты «izi»)

> Дерзкая разработка ПО с ИИ на базе агентов: команда — **человек + машина**.
> Инженер творчески прорабатывает идеи с ИИ и воплощает их с ИИ — рациональная
> автоматизация по Вирту. Репозиторий описывает процесс и раскладывает скиллы по
> ролям-агентам, чтобы на каждом шаге было понятно, что применять.

Научная основа — труды великих инженеров (Wirth, Hughes, Michtom, Linger, Mills, Witt)
и статьи автора. Подробнее — **[`CONCEPT.md`](CONCEPT.md)**.

## Быстрый старт

Репозиторий — **подключаемый мультиагентный харнес**: ставишь его в проект, и агент
ведёт задачу по SDLC-ролям сам, без ручного переключения агентов.

### Установка (рекомендуется) — one-liner, как oh-my-zsh

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/codemonstersteam/rationaldev-ai-sdlc-skills/main/bootstrap.sh)"
```

Скрипт **сам** клонирует харнес в канонический `~/.rationaldev` (`$RATIONALDEV_HOME`) и ставит
команду `rationaldev` в `PATH`. Ничего вручную качать не нужно. Дальше подключаешь **любой** репо
одной командой (раннер авто-детектится по `.claude`/`.opencode`):

```sh
rationaldev install ~/path/to/project          # или: rationaldev install <path> claude|opencode|codex
```

Обновление — **само** (клон обновляется, проекты видят это через симлинки, ноль переустановок):

```sh
export RATIONALDEV_UPDATE=auto   # на старте сессии тихо `git pull` канонического клона (throttle 1/день)
rationaldev update               # или вручную в любой момент
```

> Репо публичный → HTTPS clone/pull **анонимно**, без SSH-ключей и токенов (как oh-my-zsh). Свой форк/зеркало/SSH — `RATIONALDEV_REPO=<url>`.

### Установка (альтернатива) — локальный клон

```sh
git clone https://github.com/codemonstersteam/rationaldev-ai-sdlc-skills
cd rationaldev-ai-sdlc-skills
./install.sh claude ~/path/to/project     # или --global — для всех проектов; раннеры: claude|opencode|codex
```

Установщик **интерактивно спросит три модели** — большую/среднюю/малую (`large`/`medium`/`small`);
Enter оставляет дефолт. Имена — любого провайдера (харнес к Anthropic не привязан); правятся
позже в [`harness/models.config.json`](harness/models.config.json). Без диалога — флаг `--no-input`.
На Windows — `install.ps1` (то же, `-NoInput`). Подробно — [`harness/README.md`](harness/README.md).

Затем открой Claude Code в проекте и поставь задачу — маршрутизирует роль `orchestrator`.

**Как работать:**

1. Ставишь задачу — `orchestrator` определяет её уровень (тривиальная / модульная / эпик).
2. Ведёт по ролям: `planner` → `plan-reviewer` → **[твой Gate #1]** → `implementer` → `fixer`.
3. На гейтах (#1 план, #2 мерж, #3 релиз) останавливается и ждёт твоего решения.

**Что получишь:**

- команду из 6 ролей с контрактами вход/выход — не один агент-«всезнайка»;
- человеческие гейты на границах + трассировку решений в `.agent/decisions.log`;
- рациональный минимум тестов (юнит по формуле + компонентные + контрактные);
- то же в Codex и OpenCode — та же команда `./install.sh <runner>`.

Полный гайд, матрица установки (global/project × 3 раннера), жёсткий режим `--hard` и
достоинства подхода — **[`docs/story-harness/README.md`](docs/story-harness/README.md)**.

## Какую задачу решает

- Delivery (от плана до прода) — предсказуемая рутина; её ведут агенты, человек принимает решения на границах.
- Без единого фрейма агенты импровизируют — теряются трассируемость и воспроизводимость (инженерная дисциплина, не бюрократия).
- Слабой модели нужна процедура, а не справочник: роли как модули с контрактами вход/выход, проверяемыми до старта.

## Вектор проекта

**Цель:** проектировать и разрабатывать **распределённые приложения** на **фиксированном стеке** по
**дисциплине рациональной разработки** — научный подход к структурированию кода и тестированию, где
мультиагентская команда работает в **детерминированном workflow**. Оси процессов:

| Ось | Значения |
|---|---|
| **Задача** | epic · фича · улучшение · баг-хотфикс · рефакторинг |
| **Приложение** | web · mobile · cli · go-api |
| **Среды** | CI · PROD (канарейка) |

**Текущий статус (честно):**

- В отладке одна ячейка — `задача=фича/модуль · приложение=go-api · среды=CI→PROD-канарейка`.
- Остальные оси (web/mobile/cli, epic/hotfix/рефакторинг) — вектор, ещё не реализованы.
- Граф детерминированного конвейера ролей — **[`docs/concept-api-workflow.md`](docs/concept-api-workflow.md)**.

## Дерзкая разработка с ИИ: чего НЕТ и что есть

- **Нет тестовых сред / стендов.** Только CI и канареечные релизы прямо в прод за фиче-тогглом.
- **Канареечный выкат за фиче-тогглом** (доля трафика) на **вариативные среды** — VM, контейнер, serverless; без отдельных стендов и без обязательного Kubernetes.
- **Только компонентные тесты + математическая композиция** (доказательная корректность по построению).
- **Контрактные тесты** между компонентами — проверяются проектом [`pinout`](https://github.com/codemonstersteam/pinout).
- **Мониторинг — 4 золотых сигнала** (latency, traffic, errors, saturation).
- **CI использует утилиты экосистемы RRA** (`rra-docs-another` / `rra-audit-repo` / `rra-docs`) для валидации решений + отдельный security-scan.
- Только экспертиза и рациональный научно-обоснованный подход.

## Две стадии — обе «человек + машина»

| Стадия | Кто | Что |
|---|---|---|
| **Discovery** | инженер-разработчик **+ ИИ** | гипотезы, требования, продуктовая проработка (аналитика — здесь, отдельной роли нет) |
| **Delivery** | агенты + дирижёр (человек) | реализация задачи от плана до здоровой фичи в проде |

Граница входа агентов — момент, когда задача сформулирована. Продуктовые решения,
акцепт плана и финальный мерж остаются за человеком.

## Поток (happy path)

```
[Задача] → Входной gate ──► PLANNING ──► PLAN REVIEW ──► Human Gate #1 (акцепт плана)
                            (Wirth)       (Mills)               │
                                                                ▼
   IMPLEMENTATION ──► CI ──► CODE REVIEW ──► Human Gate #2 (мерж)
   (Hughes)           │       (Linger)              │
                      │  RRA-утилиты + security-scan ▼
                      └─ классификация ошибки   КАНАРЕЙКА в прод за тогглом
                                                (Michtom: выкат ⇄ 4 золотых сигнала)
                                                          │ GREEN→расширить / RED→откат
                                                          ▼
                                                Human Gate #3 (приёмка прод-релиза)
```

Ключевой принцип — **асимметрия генератор/критик**: кто генерирует артефакт (план,
код, выкат), тот его не принимает; ревьюер/оценщик всегда крупнее генератора.

Полный граф конвейера ролей (от `TASK.md` до прод-канарейки, с детерминированными
валидаторами-гейтами и точками LLM-решений) — **[`docs/concept-api-workflow.md`](docs/concept-api-workflow.md)**.

## Агенты «izi» — роли и имена

Общие названия ролей понятны всем; кодовые имена агентов — в честь великих инженеров,
подобраны по их вкладу (см. [`CONCEPT.md`](CONCEPT.md)).

| Роль (общая) | Агент (izi) | Шаг | Манифест |
|---|---|---|---|
| Planner | **Wirth** | PLANNING | [planner](skills/roles/planner/planner.md) |
| Plan Reviewer | **Mills** | PLAN REVIEW | [plan-reviewer](skills/roles/plan-reviewer/plan-reviewer.md) |
| Implementer | **Hughes** | IMPLEMENTATION | [implementer](skills/roles/implementer/implementer.md) |
| Fixer / Code Reviewer | **Linger** | CI + REVIEW | [fixer](skills/roles/fixer/fixer.md) |
| Release & Health | **Michtom** | RELEASE (канарейка) | [release-health](skills/roles/release-health/release-health.md) |
| Engineer-Orchestrator (человек) | **Witt** (honorary) | gates | [orchestrator](skills/roles/orchestrator/orchestrator.md) |

> Набор агентов называется **izi** — строгая рациональность, поданная легко
> (`make it as simple as possible`, по Вирту). На базе этих ролей строятся агенты
> проектирования и разработки в честь перечисленных инженеров.

## Артефакты задачи (в репо сервиса)

```
.agent/
  planner/        plan.md (источник правды), contracts/, rollout-plan.md, design/<slug>/
  plan-reviewer/  plan-review.md
  release-health/ deploy-log.md, release-health.md (4 золотых сигнала, вердикт)
  decisions.log   сквозная трассировка решений
```

## С чего начать

Сначала [`CONCEPT.md`](CONCEPT.md) (фундамент и модель), затем [`AGENTS.md`](AGENTS.md)
(правила) и [`docs/00_PROCESS.md`](docs/00_PROCESS.md) (процесс). Пошаговый онбординг —
**[`docs/get-started.md`](docs/get-started.md)**.

## Навигация

| Документ | Назначение |
|---|---|
| [`CONCEPT.md`](CONCEPT.md) | Концепция: фундамент (труды + статьи), команда человек+машина, агенты izi |
| [`docs/concept-api-workflow.md`](docs/concept-api-workflow.md) | Концепт workflow: граф детерминированного конвейера ролей (Mermaid), вектор осей задача/приложение/среды |
| [`docs/00_PROCESS.md`](docs/00_PROCESS.md) | Полное описание процесса (роли, gate'ы, канареечный CD) |
| [`docs/01_DIAGRAM.md`](docs/01_DIAGRAM.md) · [`docs/SDLC.svg`](docs/SDLC.svg) | Диаграмма потока (векторная схема CI→канарейка) |
| [`presentation/sdlc.html`](presentation/sdlc.html) | Презентация процесса — открыть локально в браузере (10 слайдов) |
| [`GLOSSARY.md`](GLOSSARY.md) | Словарь, «роль = модуль», асимметрия моделей |
| [`skills/roles/`](skills/roles/) | Манифесты ролей — что грузит каждый агент |
| [`skills/lib/`](skills/lib/) | Библиотека скиллов (домены + техники), по одной копии |
| [`SKILLS-BACKLOG.md`](SKILLS-BACKLOG.md) | Чего не хватает — бэклог скиллов (вкл. опц. высоконагруз) |
| [`docs/story-harness/`](docs/story-harness/README.md) | Харнес: подключение к Claude/Codex/OpenCode, матрица установки, [достоинства](docs/story-harness/advantages.md) |
| [`harness/`](harness/README.md) | Проекции ролей под раннеры, генератор, enforcement (`--hard`) |
| [`docs/agent-best-practices.md`](docs/agent-best-practices.md) | Внешние best-practices разработки агентов (2025–2026): источники + рекомендации, привязка к харнесу |
| [`AGENTS.md`](AGENTS.md) | Неизменяемые правила разработки |
