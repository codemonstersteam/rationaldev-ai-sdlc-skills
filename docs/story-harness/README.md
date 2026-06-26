# Харнес rationaldev — как начать

Мультиагентный SDLC-харнес для **Claude Code, Codex CLI, OpenCode**. Один источник
правды (`skills/roles/` + `skills/lib/`) проецируется в раскладку выбранного раннера.
Ставишь одной командой — получаешь команду ролей (planner → plan-reviewer →
implementer → fixer → release-health) с человеческими гейтами, без ручного
переключения агентов.

## Быстрый старт

```sh
git clone <repo-url> rationaldev-ai-sdlc-skills
cd rationaldev-ai-sdlc-skills

# подключить к проекту (выбери свой раннер)
./install.sh opencode ~/path/to/project
#   или: ./install.sh claude ~/path/to/project
#   или: ./install.sh codex  ~/path/to/project

# затем запусти раннер в проекте — точка входа: роль `orchestrator`
```

Поставил роли, ставишь задачу — `orchestrator` классифицирует её уровень и ведёт по
ролям. На Gate #1/#2/#3 он останавливается и ждёт тебя.

## Матрица установки

`./install.sh <claude|codex|opencode> [--global | <project-dir>] [--hard]`

| Раннер | В проект | Глобально | Куда кладёт |
|---|---|---|---|
| **Claude** | `./install.sh claude .` | `./install.sh claude --global` | `.claude/agents`, `.claude/skills`, `CLAUDE.md` |
| **OpenCode** | `./install.sh opencode .` | `./install.sh opencode --global` | `.opencode/agent`, `.opencode/skills`, `AGENTS.md` |
| **Codex** | `./install.sh codex .` | `./install.sh codex --global` | `.agents/skills`, `.agents/roles`, `AGENTS.md` |

- **В проект** (по умолчанию — текущая директория): харнес виден только в этом проекте.
- **`--global`**: применяется ко всем проектам (`~/.claude`, `~/.config/opencode`, `~/.codex`/`~/.agents`).
- Установка идемпотентна (симлинки): правишь источник — изменения видны сразу.

## Что получаешь

- **Роли** (агенты/субагенты): `orchestrator`, `planner` (Wirth), `plan-reviewer`,
  `implementer` (Hughes), `fixer` (Linger), `release-health` (Michtom).
- **Скиллы** из `skills/lib/` (включая `memory`), справочники — в `skills/.../reference/`.
- **Инструкции-роутер** в `CLAUDE.md`/`AGENTS.md` (ставятся **недеструктивно**: если у
  тебя уже есть такой файл — он не трогается, наш кладётся рядом как `*.harness.md`).

## Точка входа и дисциплина

- Запуск: открываешь раннер в проекте, ставишь задачу. Маршрутизирует `orchestrator`.
- **Human-gates** (#1 акцепт плана, #2 мерж, #3 приёмка прод-релиза) — за тобой.
- **Память цикла** — `.agent/memory.md` (skill `memory`); **трассировка решений** —
  `.agent/decisions.log`.

## Жёсткий режим `--hard` (опционально)

`--hard` доустанавливает enforcement-адаптер раннера (жёсткие гейты + гарантированный
`decisions.log`): OpenCode — плагин, Claude — хуки `settings.json`, Codex — остаётся на
инструкции. **Адаптеры реализуются в Slice 6**; без них база работает на инструкциях
единообразно на всех трёх.

## Обновить роли/скиллы

Источник ролей — `harness/agents/_shared/<role>.md`. После правки перегенерируй проекции:

```sh
node harness/gen-agents.mjs
```

Файлы в `harness/agents/<runner>/` и `harness/instructions/AGENTS.codex.md` —
**сгенерированные**, вручную не правь. Подробнее — `harness/README.md`.
