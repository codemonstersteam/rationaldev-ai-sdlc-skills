# rationaldev — AI-first рациональный SDLC (агенты «izi»)

> Дерзкая разработка ПО с ИИ: команда — **человек + машина**. Репозиторий — **подключаемый
> мультиагентный харнес**: ставишь его в проект, и агент ведёт задачу по SDLC-ролям сам,
> от требования до тега на транке.

Вес работы задаёт **SemVer**; стандарт разработки один для всех вертикалей. Научная основа —
труды Wirth, Hughes & Michtom, Linger, Mills, Witt и статьи автора; подробнее —
**[`CONCEPT.md`](CONCEPT.md)**.

## Что это и чего НЕ делает

- **Ведёт репозитории, которые построил сам** по жёсткому стандарту (замороженный контракт,
  дизайн-пакет, своя парадигма тестов). Стандарт **задаётся**, а не подбирается под чужой репо.
- **Нет тестовых сред и стендов** — только CI и канареечный выкат за фиче-тогглом прямо в прод
  на вариативные среды (VM/контейнер/serverless, k8s не обязателен).
- **Нет разведки чужих парадигм и conform-режима** — работа с репозиторием, сделанным не по
  стандарту, вне контура.
- **Нет эпиков** (>2 модулей или >1 репо): триаж честно детектит и **STOP**.

## Две оси

| Ось | Значения | Что определяет |
|---|---|---|
| **Вес (SemVer)** | `greenfield` · `patch` · `minor` · `major` · `chore` | глубину дизайна · бамп транка · тоггл · набор тестов |
| **Форма проекта** | `service` · `cli` | шаблон, вид контракта, ingress-скилл, разделы README (`harness/target-profiles.json`) |

Решающая ось веса — **обратная совместимость документированного контракта** (SemVer 2.0.0
дословно). Классификатор — `@wirth-triage`; `izi` роутит по вердикту механически.

## Пять вертикалей

| Вес | Что | Транк | Тоггл | Пошаговый флоу |
|---|---|---|---|---|
| **greenfield** | сервиса/CLI ещё нет (v0 → v1) | `1.0.0` | новое OFF | [`greenfield-flow`](docs/flows/greenfield-flow.md) |
| **patch** | обратно совместимый багфикс, контракт не меняется | `Z+1` | обычно нет | [`patch-flow`](docs/flows/patch-flow.md) |
| **minor** | аддитивная новая способность (проверяется механически) | `Y+1.0` | **OFF обязателен** | [`minor-flow`](docs/flows/minor-flow.md) |
| **major** | несовместимое изменение + миграция + breaking-список | `X+1.0.0` | тоггл + миграция | [`major-flow`](docs/flows/major-flow.md) |
| **chore** | репо-плумбинг (CI, Dockerfile, конфиги, доки) | **no-bump** | — | [`chore-flow`](docs/flows/chore-flow.md) |

## Три человеческих гейта

| Гейт | Что принимает | Как |
|---|---|---|
| **#1** | план (`PLAN.md` / `CHORE-PLAN.md`) | токен **`GATE1 APPROVE`** → гардрейл ставит `.agent/gates/gate1.approved`; до маркера имплементаторы жёстко заблокированы |
| **#2** | мерж PR | токен **`GATE2 APPROVE`** → `.agent/gates/gate2.approved`; после мерджа `@ledger` закрывает прогон |
| **#3** | прод-релиз после канарейки | вердикт по 4 золотым сигналам на 100% |

Маркеры ставит **только гардрейл** по точному токену — ни агент, ни роль самоакцепт не делают.

## Закрытие прогона

После Gate #2 `@ledger` вызывает `harness/close-run.mjs`: **пруф мерджа** → **тег** на транке
(`ci/semver-bump.mjs`; форма тега — от последнего релизного тега репо) → запись в
`docs/changes/LEDGER.md` → **атомарный вайп** `.agent/`. `no-bump` — нормальный исход.
Тег ставит только `@ledger`; `ci/recipes/*` — образец для репозиториев **без** харнеса.

## Быстрый старт

### Установка (рекомендуется) — one-liner, как oh-my-zsh

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/codemonstersteam/rationaldev-ai-sdlc-skills/main/bootstrap.sh)"
```

Скрипт **сам** клонирует харнес в канонический `~/.rationaldev` (`$RATIONALDEV_HOME`) и ставит
команду `rationaldev` в `PATH`. Дальше подключаешь **любой** репо одной командой (раннер
авто-детектится по `.claude`/`.opencode`):

```sh
rationaldev install ~/path/to/project          # или: rationaldev install <path> claude|opencode|codex
```

Обновление — **вручную** `rationaldev update` (`git pull --ff-only` клона; проекты видят новое через симлинки, ноль переустановок). Авто-апдейт пока отключён.

```sh
rationaldev update
```

> Репо публичный → HTTPS clone/pull **анонимно**, без SSH-ключей и токенов (как oh-my-zsh). Свой форк/зеркало/SSH — `RATIONALDEV_REPO=<url>`.

**opencode:** установка настраивает провайдера в **global** (`~/.config/opencode`, спросит URL+ключ, если пусто; предупредит про omo) и кладёт в проект **минимальный** `opencode.jsonc` (`permission` + `plugin` rational-guardrail). Модели ролей — **два тира** (`large`=суждение · `small`=исполнение) в `models.config.json` → frontmatter; в `opencode.jsonc` моделей нет.

### Установка (альтернатива) — локальный клон

```sh
git clone https://github.com/codemonstersteam/rationaldev-ai-sdlc-skills
cd rationaldev-ai-sdlc-skills
./install.sh claude ~/path/to/project     # или --global — для всех проектов; раннеры: claude|opencode|codex
```

Установщик **интерактивно спросит модели по тирам**; Enter оставляет дефолт. Имена — любого
провайдера (харнес к Anthropic не привязан); правятся позже в
[`harness/models.config.json`](harness/models.config.json). Без диалога — флаг `--no-input`.
На Windows — `install.ps1` (то же, `-NoInput`). Подробно — [`harness/README.md`](harness/README.md).

### Как работать

1. Открываешь раннер в проекте с точкой входа **`izi`** и ставишь задачу («прочитай `./TASK.md` и веди задачу»).
2. `@gilb` делает требование измеримым → `@wirth-triage` определяет **вес** → `izi` запускает вертикаль.
3. На гейтах (#1 план, #2 мерж, #3 релиз) конвейер останавливается и ждёт твоего токена.
4. После мерджа `@ledger` ставит тег, пишет `LEDGER.md` и стирает состояние прогона.

**Что получишь:** команду ролей с контрактами вход/выход вместо агента-«всезнайки»; человеческие
гейты на границах + трассировку в `.agent/decisions.log`; рациональный минимум тестов (юниты по
формуле + компонентные + контрактные); версионированный транк без ручной арифметики.

Полный гайд, матрица установки (global/project × 3 раннера) и жёсткий режим `--hard` —
**[`docs/story-harness/README.md`](docs/story-harness/README.md)**.

## Артефакты задачи (в репо сервиса)

```
.agent/                     состояние ОТКРЫТОГО прогона (стирается при закрытии)
  planner/                  brd.md · mode (вес) · frd.md · slices.md · change-dir · done.log
  gates/                    gate1.approved · gate2.approved (ставит только гардрейл)
  vcs/                      branch
  decisions.log             сквозная трассировка (переживает вайп)
docs/design/<slice>/        use-case · c4 · module-tree · contracts · tickets/ (greenfield)
docs/design/<slice>/changes/<NNN-slug>/   change-delta · PLAN · tickets/ · adr/ (patch|minor|major)
docs/chores/<NNN-slug>/CHORE-PLAN.md      chore
docs/changes/LEDGER.md      append-only запись закрытых прогонов
api-specification/          ОДИН замороженный контракт на сервис
```

## Навигация

| Документ | Назначение |
|---|---|
| [`CONCEPT.md`](CONCEPT.md) | Концепция: фундамент, стандарт разработки, классификатор веса, вертикали, роли |
| [`docs/flows/`](docs/flows/) | Пошаговые флоу пяти вертикалей (In/Out/проверка/раунды/тир) |
| [`requirements/semver-verticals.md`](requirements/semver-verticals.md) | FRD SemVer-вертикалей: use-cases, data dictionary, failure-map |
| [`docs/00_PROCESS.md`](docs/00_PROCESS.md) | Процесс целиком: роли, вертикали, гейты, канареечный CD |
| [`docs/harness-flow.md`](docs/harness-flow.md) | Граф работы харнеса (плоская диспетчеризация, depth-1) |
| [`docs/01_DIAGRAM.md`](docs/01_DIAGRAM.md) | Диаграмма процесса (Mermaid) |
| [`docs/05_REPO_STRUCTURE.md`](docs/05_REPO_STRUCTURE.md) | Где живёт какой артефакт |
| [`GLOSSARY.md`](GLOSSARY.md) | Словарь: вес, вертикаль, пруф мерджа, no-bump, закрытие прогона |
| [`skills/roles/`](skills/roles/) | Манифесты ролей — что грузит каждый агент |
| [`skills/lib/`](skills/lib/) | Библиотека скиллов (домены + техники), по одной копии |
| [`ci/`](ci/README.md) | `semver-bump.mjs` + рецепты CI для репозиториев **без** харнеса |
| [`SKILLS-BACKLOG.md`](SKILLS-BACKLOG.md) | Чего не хватает — бэклог скиллов |
| [`docs/story-harness/`](docs/story-harness/README.md) | Харнес: подключение к Claude/Codex/OpenCode, матрица установки |
| [`harness/`](harness/README.md) | Роли, валидаторы, генератор, enforcement (`--hard`) |
| [`docs/agent-best-practices.md`](docs/agent-best-practices.md) | Внешние best-practices разработки агентов, привязка к харнесу |
| [`AGENTS.md`](AGENTS.md) | Неизменяемые правила разработки |

## С чего начать

Сначала [`CONCEPT.md`](CONCEPT.md) (фундамент и стандарт), затем вертикаль своей задачи в
[`docs/flows/`](docs/flows/) и [`AGENTS.md`](AGENTS.md) (правила). Пошаговый онбординг —
**[`docs/get-started.md`](docs/get-started.md)**.
