# CLAUDE.md — Контекст проекта для агента

## Проект

**rationaldev** — AI-first рациональный SDLC на базе агентов «izi» для дерзкого стартапа.
Команда = человек + машина. Только CI + канареечные релизы (нет тестовых сред). Концепция —
`CONCEPT.md`, правила — `AGENTS.md`, процесс — `docs/00_PROCESS.md`.

## Принятые решения

- **6 ролей-агентов (izi)** с кодовыми именами инженеров: `planner`=Wirth, `plan-reviewer`=Mills,
  `implementer`=Hughes, `fixer`=Linger, `release-health`=Michtom (слияние Release+SRE),
  `orchestrator`=Witt (человек-дирижёр, honorary).
- **Нет тестовых сред.** Деплой — канарейкой за фиче-тогглом прямо в прод на вариативные
  среды (VM/контейнер/serverless, не обязательно k8s). Без колец big-tech.
- **Human Gates — три:** #1 акцепт плана, #2 мерж, #3 приёмка прод-релиза после канарейки.
- **Тесты:** только компонентные + контрактные (проверяет `pinout`). Корректность модулей —
  математической композицией (`program-design`).
- **Мониторинг — 4 золотых сигнала.** Безопасность — на планировании + security-scan в CI.
- **CI использует утилиты экосистемы RRA** для валидации решений.
- **Убрано:** тестовые среды/стенды, кольца/k8s-обязательность, презентация, банковский контекст,
  скиллы `tech-radar`/`qa`; `analytics` схлопнут в продуктовую разработку (Discovery инженер+ИИ).
- **Фундамент:** труды Wirth / Hughes & Michtom / Linger, Mills, Witt + статьи автора.

## Статус

Репозиторий переработан из `rational-skills-ai` под стартаперский SDLC.

| Артефакт | Статус |
|---|---|
| README, CONCEPT | ✅ переработаны |
| Роли (6, izi-имена), `release-health` | ✅ |
| `skills/lib/observability` (4 сигнала, канарейка) | ✅ |
| `skills/lib/contract-tests` (pinout) | ✅ новый |
| SKILLS-BACKLOG (canary/security/contract/высоконагруз) | ✅ |
| GLOSSARY | ✅ |
| `docs/00_PROCESS`, `01_DIAGRAM`, `02_MEASUREMENT`, `03_REPORTING`, `get-started` | ✅ вычищены (стенд/кольца/sre/банк убраны) |
| `plan.md`, `CONTRIBUTING.md`, `docs/story/*`, `skills/lib/{security,architecture,git-conventions,code-style}` | ✅ вычищены |
| Манифесты ролей (загрузка скиллов, гейты) | ✅ выровнены (нет analytics/qa/tech-radar; гейты #1–3) |
| `docs/SDLC.svg` (заменил `.jpeg`) + `presentation/sdlc.html` | ✅ перерисованы под CI→канарейку |

## Следующий шаг

Ревью репозитория; при желании — завести GitHub-репо. Грязных маркеров
(стенд/кольца/SRE-агент/банк/удалённые скиллы) не осталось. Диаграмма (`docs/SDLC.svg`)
и презентация (`presentation/sdlc.html`) перерисованы под CI→канарейку.

## Фрейм работы с агентом

> Агент: прочитай `CONCEPT.md` и `AGENTS.md` перед тем как отвечать.
