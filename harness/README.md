# harness/ — проекции ролей под раннеры

## Quickstart (opencode)

```sh
# 1) установить харнес в проект (создаёт .opencode/agent + plugins; enforcement по умолчанию)
sh install.sh opencode /path/to/project      # или --global на все проекты; --soft отключить enforcement
# 2) запустить точку входа
cd /path/to/project && opencode --agent izi
# 3) дать задачу: «Прочитай ./TASK.md и веди задачу»
```

Точка входа — **`izi`** (оркестратор-роутер). Голый проект без `.opencode/` харнес не подхватит
автоматически — сперва `install.sh`. Модели ролей — в `models.config.json`.


> Концептуальный обзор «как устроен и работает харнес» (C4, маршрутизация, роли, скиллы) —
> [`docs/harness/`](../docs/harness/README.md).

Подключаемый мультиагентный харнес. **Единый источник правды роли** —
`agents/_shared/<role>.md` (frontmatter-идентичность + тело-промпт); скиллы — в
`../skills/lib/`. Отсюда генерируются **проекции**: Claude / OpenCode / Codex и
человекочитаемый контракт роли `../skills/roles/<role>/<role>.md`.

## Что где

| Путь | Назначение | Править вручную? |
|---|---|---|
| `agents/_shared/<role>.md` | **единый источник правды роли**: frontmatter-идентичность (`version/tier/mode/temperature/steps/skills/inputs/outputs/permission/description`) + тело-промпт | **да** — это источник |
| `agents/{claude,opencode,codex}/<role>.md` | сгенерированные проекции с per-runner frontmatter | **нет** — перегенерируются |
| `../skills/roles/<role>/<role>.md` | сгенерированный человекочитаемый контракт роли (для README/docs) | **нет** — перегенерируется |
| `../skills/INDEX.json` | сгенерированный реестр скиллов (name/path/version/status/description) + карта роль→скиллы | **нет** — перегенерируется |
| `frontmatter.mjs` | общий парсер frontmatter (используют оба генератора) | да |
| `gen-agents.mjs` | генератор: читает frontmatter `_shared` → 3 раннера + контракт роли | да (только рендереры) |
| `gen-skill-index.mjs` | реестр `INDEX.json` + CI-инварианты: скилл из `skills:` роли существует и `stable`; целостность пайплайна (каждый `input` роли производится апстримом или внешний) | да |

## Перегенерация

```sh
node harness/gen-agents.mjs         # → agents/{claude,opencode,codex}/*.md + skills/roles/*
node harness/gen-skill-index.mjs    # → skills/INDEX.json (реестр + проверка ссылок)
node harness/gen-skill-index.mjs --check   # CI: реестр актуален и ссылки роль→скилл целы
```

Правишь роль (тело **или** идентичность: tier/mode/perm/skills/описание) — меняй frontmatter
и тело в `agents/_shared/<role>.md` и перегенерируй. Никогда не правь файлы в
`agents/<runner>/`, `skills/roles/` или `skills/INDEX.json` напрямую: они перезапишутся.
Тир/права/температуру больше **не** хардкодят в генераторе — они в frontmatter роли.
Добавил/переименовал скилл — перегенерируй `INDEX.json`; ссылку из роли на несуществующий
скилл `--check` завалит (smoke прогоняет это автоматически).

## Назначение моделей (`models.config.json`)

Имена моделей **не** хардкодятся в генераторе — они в `harness/models.config.json`
(харнес не привязан к Anthropic). На каждый раннер — `tiers` (дефолт по тиру роли) и
`roles` (переопределение конкретной роли, важнее тира). Резолвинг роли:
`roles[<роль>] > tiers[<тир>] > пусто` (пусто → `model` опущен, раннер берёт модель
пользователя). Тир роли — в `agents/_shared/<role>.md` (`tier: large|medium|small`).
Дефолт — раскладка на 3 модели.

**Интерактивно при установке.** `install.sh <runner>` (и `install.ps1` на Windows)
спрашивает три модели — большую (`large`), среднюю (`medium`), малую (`small`) —
показывает текущее значение как дефолт (Enter оставляет его, пустой ввод = наследовать
модель пользователя), пишет их в `models.config.json[<runner>].tiers` и перегенерирует
проекции. Флаг `--no-input` (`-NoInput`) пропускает диалог — берёт модели из конфига как есть
(используется в CI/смоуке).

**Вручную.** Правишь `models.config.json` (в т.ч. пер-ролевые оверрайды в `roles`,
которые диалог не трогает) → `node harness/gen-agents.mjs` → переустанавливаешь.

### Локальный override моделей (`RATIONALDEV_MODELS`) — клон остаётся pristine

Канонический клон (`~/.rationaldev`) потребляется **read-only**: `rationaldev update` — это
`git pull --ff-only` с pristine-инвариантом (любая локальная правка клона → апдейт отменяется).
Поэтому свои модели держат **не** в клон-файле `models.config.json`, а в **локальном override
ВНЕ клона** — `$RATIONALDEV_MODELS` (по умолчанию `${XDG_CONFIG_HOME:-~/.config}/rationaldev/models.json`,
**один файл на все раннеры**: структура раннер-агностична — top-level ключ = раннер). При установке
override **дефолтится автоматически для всех раннеров** (`install.sh`/`install.ps1`): интерактивный
`configure-models` и авто-дерив тиров пишут туда, клон-`models.config.json` не трогается.

`loadModelsConfig` в рантайме сливает override **поверх** клон-дефолта (`mergeModelsConfig`: override
выигрывает на листьях), и `gen-agents` рендерит проекции ролей с реальными моделями. Так как проекции
(`agents/{claude,opencode,codex}/*.md`) трекаются в git, при кастомных моделях установщик **выносит их
из клона** (claude/codex — копия в `${XDG_DATA_HOME:-~/.local/share}/rationaldev/projections/<runner>`
+ перецеленный симлинк; Windows — копия сразу в проект) и **восстанавливает клон из git** — так клон
остаётся чистым и `rationaldev update` проходит. Дефолтные модели (проекции == коммит) → прямой
dir-symlink на клон (обновление проекта = `git pull`, без переустановки).

Свой путь override — `export RATIONALDEV_MODELS=/path/models.json` до установки. Проверить здоровье
установки (клон чист · override резолвится · симлинки живые · `settings.json` не разошёлся ·
PATH-проводка на месте) — `rationaldev doctor [project-dir]`.

### Авто-детект оболочки (`bootstrap.sh` прописывает PATH сам)

`bootstrap.sh` определяет вашу оболочку и дописывает `~/.local/bin` в PATH **только** в rc-файл(ы)
обнаружённой оболочки — ручная правка профиля не нужна. Порядок детекта: `$RATIONALDEV_SHELL`
(override) → `basename $SHELL` → родительский процесс (`ps -p $PPID`) → `sh`. Карта:

| Оболочка | Куда пишет | Строка |
|---|---|---|
| **zsh** | `${ZDOTDIR:-$HOME}/.zshrc` | `export PATH="$HOME/.local/bin:$PATH"` |
| **bash** | `~/.bashrc` **и** `~/.bash_profile` (macOS-логин читает второй) | `export PATH=…` |
| **fish** | `~/.config/fish/config.fish` | `fish_add_path "$HOME/.local/bin"` |
| **other** | `~/.profile` | POSIX `export PATH=…` |

Файл создаётся, если его нет; проводка идемпотентна по маркеру `# rationaldev bin (bootstrap)`
(повторный `bootstrap.sh` не дублирует). В чужие оболочки НЕ пишет. Оболочку можно навязать —
`RATIONALDEV_SHELL=fish sh bootstrap.sh` (полезно на CI/в контейнере, где `$SHELL` пуст). После
установки `rationaldev doctor` проверяет, что маркер в rc обнаружённой оболочки есть и команда
`rationaldev` резолвится; красный пункт печатает точную команду починки.

## Различия проекций

- **Claude:** frontmatter `name`/`description`/`model` (модель из `models.config.json`; пусто → опущена).
- **OpenCode:** `description`/`mode`/`temperature`/`steps`/`permission`/`model` (модель из конфига; пусто → наследуется).
  `steps` = анти-runaway кап; `permission.edit` glob-скоуп = gaming-guard + асимметрия critic.
- **Codex:** тело-блок без frontmatter — собирается в `AGENTS.md` установщиком (Slice 2–3); модель — в конфиге Codex.

Дальше: `install.sh` (Slice 2) раскладывает это в каталоги раннера.
