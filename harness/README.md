# harness/ — проекции ролей под раннеры

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

## Различия проекций

- **Claude:** frontmatter `name`/`description`/`model` (тир → `large`=`opus` / `medium`=`sonnet` / `small`=`haiku`).
- **OpenCode:** `description`/`mode`/`temperature`/`steps`/`permission` (модель наследуется).
  `steps` = анти-runaway кап; `permission.edit` glob-скоуп = gaming-guard + асимметрия critic.
- **Codex:** тело-блок без frontmatter — собирается в `AGENTS.md` установщиком (Slice 2–3).

Дальше: `install.sh` (Slice 2) раскладывает это в каталоги раннера.
