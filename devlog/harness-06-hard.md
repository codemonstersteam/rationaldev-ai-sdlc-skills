# devlog/harness-06-hard.md

## Задача

Slice 6: жёсткий режим `--hard` — enforcement гейтов и `decisions.log` там, где
раннер это умеет (OpenCode, Claude); Codex остаётся на инструкции.

## Контекст и ограничения

- Единого механизма нет: OpenCode — plugin API (`tool.execute.before/after`),
  Claude — хуки `settings.json` (`PreToolUse`/`PostToolUse`, shell), Codex — бедная
  хук-поверхность.
- Контракт един для opencode/claude: блок `implementer` без `plan-review.md` +
  `.agent/gates/gate1.approved`; append `.agent/decisions.log` на каждое делегирование.
- Установка `--hard` не должна затирать существующий `settings.json`.

## Принятое решение

- `harness/enforcement/opencode/rational-guardrail.ts` — плагин (порт референса) +
  `guardrail.smoke.ts` (Node-нативный TS).
- `harness/enforcement/claude/` — `gate-check.sh` (PreToolUse, exit 2 = блок),
  `log-decision.sh` (PostToolUse, append), `settings.harness.json` (шаблон).
- `harness/enforcement/codex/README.md` — почему инструкция (нет блокирующих хуков).
- `install.sh --hard`: opencode → симлинк плагина в `.opencode/plugins/`; claude →
  хуки в `.claude/hooks/` + генерация `settings.json` с абсолютными путями
  (недеструктивно: если `settings.json` есть — `settings.harness.json` + ручной слив);
  codex → сообщение про инструкцию.
- `harness/smoke/run.sh` расширен enforcement-проверками.

## Отклонённые варианты

- Единый плагин на все раннеры — невозможно (разные API).
- Парсинг JSON хуками через jq — отклонено: без зависимости, `grep`/`sed` по `subagent_type`.
- Затирать `settings.json` — отклонено (недеструктивная установка).

## Результат

- `./harness/smoke/run.sh` → **PASS 20** (установка ×3 + enforcement: плагин-смоук 5/5,
  Claude gate block/pass, лог).
- `node harness/enforcement/opencode/guardrail.smoke.ts` → PASS 5/5.
- Slice 6 завершён; харнес покрыт полностью (база + опциональный `--hard`).
