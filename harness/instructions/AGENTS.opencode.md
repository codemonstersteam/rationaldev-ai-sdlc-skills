# AGENTS.md — харнес rationaldev (OpenCode)

Подключён мультиагентный SDLC-харнес. **Точка входа — primary-агент `orchestrator`**
(`.opencode/agent/orchestrator.md`): он классифицирует уровень задачи и делегирует
роли (`planner`, `plan-reviewer`, `implementer`, `fixer`, `release-health`) через
нативный `task` с `task_budget`/depth-лимитами.

Скиллы — в `.opencode/skills/` (грузятся по имени). Рабочая память цикла —
`.agent/memory.md` (skill `memory`). Трассировка решений — `.agent/decisions.log`.

Human-gates (#1 акцепт плана, #2 мерж, #3 приёмка прод-релиза) обязательны и
остаются за оператором. Маршрутизация и протокол гейтов — в агенте `orchestrator`.
