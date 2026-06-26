# devlog/harness-01-source-to-agents.md

## Задача

Slice 1 харнеса: спроецировать 6 SDLC-ролей в формат агента под каждый раннер
(Claude, OpenCode, Codex) из единого источника.

## Контекст и ограничения

- Источник — `skills/roles/*` (контракты) + `skills/lib/*` (скиллы, уже `SKILL.md`).
- Форматы раннеров выверены: Claude `.claude/agents/*.md` (`name`/`description`/`model`);
  OpenCode `.opencode/agent/*.md` (`description`/`mode`/`temperature`/`steps`/`permission`);
  Codex — **нет** стандартного файлового формата субагентов (скиллы в `.agents/skills/`,
  роли укладываются в `AGENTS.md`).
- Цель «один источник, не три репо» → избегаем дрейфа 6×3 = 18 файлов.

## Принятое решение

- **Генератор** `harness/gen-agents.mjs`: каноничное тело `agents/_shared/<role>.md` +
  META (тир, mode, temp, steps, permission) → 18 проекций.
- Claude: тир → модель (`opus`/`sonnet`). OpenCode: модель опущена (наследуется),
  `steps` и `permission.edit` glob-скоуп кодируют анти-runaway и асимметрию critic.
- Codex: тело-блок без frontmatter (сборка в `AGENTS.md` — Slice 2–3).
- `harness/README.md`: `_shared` — источник, `agents/<runner>/` не править руками.

## Отклонённые варианты

- 18 статических файлов — отклонено: дрейф при правке роли.
- Codex subagent-файлы своего формата — отклонено: формат не стандартизован в доках,
  роли надёжнее укладывать в `AGENTS.md`.
- Хардкод провайдер-модели для OpenCode — отклонено: ломает установку у иных провайдеров.

## Результат

- `node harness/gen-agents.mjs` → 18 файлов в `agents/{claude,opencode,codex}/`.
- 6 тел в `agents/_shared/`, генератор, README харнеса.
- Дальше: Slice 2 — `install.sh` раскладывает проекции + скиллы в каталоги раннера.
