# devlog/harness-02-install.md

## Задача

Slice 2 харнеса: `install.sh` — раскладывает проекции агентов + скиллы в каталоги
выбранного раннера; режимы global/project; флаг `--hard` (под Slice 6).

## Контекст и ограничения

- Пути раннеров: Claude `.claude/{agents,skills}`; OpenCode `.opencode/{agent,skills}`
  (agent — singular); Codex скиллы `.agents/skills`, роли — в `AGENTS.md` (нет файлового
  формата субагентов).
- Скиллы: `skills/lib/*` содержит и директории с `SKILL.md`, и плоские справочники
  (`architecture.md`, `code-style.md`, `observability.md`, `security.md`).
- Симлинки, не копии — правки источника видны сразу.

## Принятое решение

- `./install.sh <runner> [--global | <dir>] [--hard]`. По умолчанию project = cwd.
- Скиллы: dirs с `SKILL.md` → `<skills>/<name>`; плоские → `<skills>/reference/<name>.md`.
- Claude/OpenCode: проекции `harness/agents/<runner>/*` → каталог агентов раннера.
- Codex: роли стейджатся в `.agents/roles/` (сборка в `AGENTS.md` — Slice 3).
- `--hard`: ищет `harness/enforcement/<runner>/`; нет адаптера → явное сообщение (Slice 6).
- Идемпотентность `ln -sfn`.

## Отклонённые варианты

- Копирование вместо симлинков — рассинхрон с источником.
- Сборка Codex `AGENTS.md` прямо здесь — отнесено в Slice 3 (это инструкции/роутер).

## Результат

Проверено на временных каталогах для всех трёх раннеров:
- claude: 6 агентов + 14 скилл-узлов; opencode: 6 + 14 (`--hard` → корректная заглушка);
  codex: 6 ролей в `.agents/roles` + скиллы + `reference/`.
- `program-design/SKILL.md` и `memory/SKILL.md` резолвятся через симлинки.
- Дальше: Slice 3 — роутер в `CLAUDE.md`/`AGENTS.md` (+ сборка Codex-ролей).
