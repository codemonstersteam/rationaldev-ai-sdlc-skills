# harness/ — проекции ролей под раннеры

Подключаемый мультиагентный харнес. Источник правды — `../skills/roles/` (контракты
ролей) и `../skills/lib/` (скиллы). Здесь — **проекции** под Claude / OpenCode / Codex.

## Что где

| Путь | Назначение | Править вручную? |
|---|---|---|
| `agents/_shared/<role>.md` | каноничное тело агента (система-промпт роли) | **да** — это источник |
| `agents/{claude,opencode,codex}/<role>.md` | сгенерированные проекции с per-runner frontmatter | **нет** — перегенерируются |
| `gen-agents.mjs` | генератор: `_shared` + META → 3 раннера | да (META, рендереры) |

## Перегенерация

```sh
node harness/gen-agents.mjs    # → agents/{claude,opencode,codex}/*.md
```

Правишь тело роли — меняй `agents/_shared/<role>.md` и перегенерируй. Никогда не
правь файлы в `agents/<runner>/` напрямую: они перезапишутся.

## Различия проекций

- **Claude:** frontmatter `name`/`description`/`model` (тир → `opus`/`sonnet`).
- **OpenCode:** `description`/`mode`/`temperature`/`steps`/`permission` (модель наследуется).
  `steps` = анти-runaway кап; `permission.edit` glob-скоуп = gaming-guard + асимметрия critic.
- **Codex:** тело-блок без frontmatter — собирается в `AGENTS.md` установщиком (Slice 2–3).

Дальше: `install.sh` (Slice 2) раскладывает это в каталоги раннера.
