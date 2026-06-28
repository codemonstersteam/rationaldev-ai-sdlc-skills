# Доступные скиллы

Скиллы этого харнеса (машинный реестр — [`skills/INDEX.json`](../../skills/INDEX.json)) и
ссылки на готовые скиллы Anthropic. Как писать скиллы — [agent-skills.md](agent-skills.md).

## Скиллы харнеса (18)

### Требования и проектирование
| Скилл | Вер. | Назначение |
|---|---|---|
| `requirements-intake` | 1.0 | BRD → FRD: акторы, интерфейсы, use-cases по Кокберну, контракт + карта отказов |
| `program-design` | 1.0 | Проектирование: вертикальные срезы, контракты модулей, юнит-тесты по формуле (progressive disclosure) |
| `program-implementation` | 1.0 | Реализация по тикетам, TBD: 1 тикет = 1 срез = 1 ветка = 1 PR |

### Тесты
| Скилл | Вер. | Назначение |
|---|---|---|
| `component-tests` | 1.0 | Компонентные тесты как чёрный ящик (сервис/CLI), формула покрытия, Docker Compose |
| `contract-tests` | 0.1/draft | Контракты между компонентами (consumer-driven) через `pinout`/netlist |

### Домены
| Скилл | Вер. | Назначение |
|---|---|---|
| `architecture` | 1.0 | Границы модулей + сетевая связанность (agent-ready) |
| `security` | 1.0 | Безопасность как требование плана + security-scan в CI |
| `observability` | 2.0 | SLI/SLO/guardrail + 4 золотых сигнала + канареечный release-health |
| `code-style` | 1.0 | Конвенции + обязательные практики (фича-тоггл OFF, идемпотентность, секреты из vault) |

### Внешний I/O
| Скилл | Вер. | Назначение |
|---|---|---|
| `http-io` | 1.0 | I/O-объект поверх HTTP к дозируемому сервису: два бюджета, curl-first, спека провайдера |
| `llm-client` | 1.0 | LLM-специфика I/O (OpenAI-совместимый протокол, structured output) — поверх `http-io` |

### Документация
| Скилл | Вер. | Назначение |
|---|---|---|
| `documentation` | 1.0 | Создание/сопровождение доки сервиса как продукта (C4, use case, README) |
| `doc-quality-review` | 1.0 | Рубрика ревью качества доки (IBM 6 характеристик) |
| `md-formatting` | 1.0 | Самопроверка форматирования Markdown перед коммитом |
| `platform-landing` | 1.0 | Лэндинг concept-репо + жизненный цикл кросс-сервисной фичи |

### Процесс и утилиты
| Скилл | Вер. | Назначение |
|---|---|---|
| `git-conventions` | 1.0 | Trunk-Based Development: ветки, коммиты, PR |
| `memory` | 1.0 | Рабочая память цикла (Ralph Loop) в `.agent/memory.md` |
| `communication` | 1.0 | Прагматичный (token-saving) стиль вывода для исполнительных ролей |

## Какая роль что грузит

| Роль | Тир | Грузит скиллов |
|---|---|---|
| `orchestrator` | large | 2 (`memory`, `platform-landing`) |
| `planner` | large | 10 (`requirements-intake`, `program-design`, домены, I/O, …) |
| `plan-reviewer` | large | 5 |
| `implementer` | small | 10 |
| `fixer` | large | 7 |
| `release-health` | medium | 2 (`observability`, `security`) |

Точные списки — `skills:` в манифестах ролей (`harness/agents/_shared/<role>.md`) и в
`skills/INDEX.json` (карта роль→скиллы). CI (`gen-skill-index --check`) гарантирует, что
роль ссылается только на существующие `stable`-скиллы.

## Готовые скиллы Anthropic

Каталог открытых скиллов Anthropic — переиспользуй и подсматривай структуру:

- Репозиторий **anthropics/skills** — https://github.com/anthropics/skills
- Пример скилла `frontend-design` — https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Раздел «Available skills» в доках — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#available-skills

## Первоисточники

- Agent Skills — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- anthropics/skills — https://github.com/anthropics/skills
