# language: ru
Функция: Подключаемый мультиагентный харнес
  Как инженер, выбравший раннер (Claude / Codex / OpenCode)
  Я хочу подключить харнес одной командой и вести задачу по SDLC-ролям
  Чтобы не переключать агентов вручную и иметь трассируемость

  # --- @auto: установка детерминирована, прогоняется harness/smoke/run.sh ---

  @auto
  Сценарий: Установка для Claude кладёт роли и скиллы
    Дано чистый проект
    Когда выполняется "./install.sh claude <proj>"
    Тогда в .claude/agents 6 ролей-агентов
    И в .claude/skills есть скилл memory
    И создан CLAUDE.md

  @auto
  Сценарий: Установка для OpenCode кладёт агентов и инструкции
    Дано чистый проект
    Когда выполняется "./install.sh opencode <proj>"
    Тогда в .opencode/agent 6 агентов
    И создан корневой AGENTS.md

  @auto
  Сценарий: Установка для Codex собирает роли в AGENTS.md
    Дано чистый проект
    Когда выполняется "./install.sh codex <proj>"
    Тогда в .agents/roles 6 ролей и в .agents/skills есть memory
    И AGENTS.md содержит блок orchestrator и блоки ролей (Hughes)

  @auto
  Сценарий: Существующий AGENTS.md не затирается
    Дано в проекте уже есть AGENTS.md с содержимым оператора
    Когда выполняется "./install.sh codex <proj>"
    Тогда оригинальный AGENTS.md не изменён
    И инструкции харнеса положены рядом как AGENTS.harness.md

  # --- @manual @model: маршрутизация требует живой модели, прогоняет оператор ---

  @manual @model
  Сценарий: Модульная задача проходит planner → plan-reviewer → implementer
    Дано задача уровня «модуль» (1–2 модуля, меняется контракт)
    Когда orchestrator классифицирует уровень и делегирует
    Тогда planner (Wirth) выдаёт план и контракт
    И plan-reviewer ОТКЛОНЯЕТ план при дыре в контракте
    И после правки и Gate #1 implementer (Hughes) реализует slice
    И переходы ролей записаны в .agent/decisions.log
