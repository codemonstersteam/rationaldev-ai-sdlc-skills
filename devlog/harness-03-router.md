# devlog/harness-03-router.md

## Задача

Slice 3 харнеса: роутер/инструкции под раннеры — уровень задачи → цепочка ролей →
human-gates → memory/decisions.log; для Codex — сборка ролей в `AGENTS.md`.

## Контекст и ограничения

- Инструкции читаются по-разному: Claude — `CLAUDE.md`; OpenCode — корневой `AGENTS.md`
  (роутинг уже в primary-агенте `orchestrator`); Codex — `AGENTS.md` + роли инлайн
  (нет файловых субагентов).
- **Риск затирания** существующего `AGENTS.md`/`CLAUDE.md` целевого проекта — недопустимо.

## Принятое решение

- `harness/instructions/`: `CLAUDE.md` (Claude-фрейминг оркестратора + субагенты),
  `AGENTS.opencode.md` (кратко: точка входа — агент `orchestrator`),
  `AGENTS.codex.md` (генерируется: роутер-шапка + 6 блоков ролей).
- `gen-agents.mjs` дополнен: собирает `AGENTS.codex.md` из `_shared` (порядок: orchestrator → роли).
- `install.sh` ставит инструкции **недеструктивно**: если файл существует и не симлинк —
  кладёт рядом `*.harness.md` и просит подключить вручную; иначе симлинкует.
- OpenCode-инструкции → корневой `AGENTS.md` проекта (project) / `~/.config/opencode/AGENTS.md` (global).

## Отклонённые варианты

- Затирать/append прямо в существующий `AGENTS.md`/`CLAUDE.md` — отклонено (риск потери).
- Полноценный merge-парсер блоков — избыточно для MVP; достаточно `*.harness.md` + ручное подключение.

## Результат

Проверено на временных каталогах:
- claude/codex (fresh) — инструкции положены; codex `AGENTS.md` = роутер + 6 ролей.
- codex/opencode с **существующим** `AGENTS.md` — оригинал не тронут, рядом `AGENTS.harness.md`.
- Дальше: Slice 4 — README «Как начать» + матрица установки.
