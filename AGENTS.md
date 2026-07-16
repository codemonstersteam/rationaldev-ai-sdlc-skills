# AGENTS.md — харнес rationaldev (репо-инструкция для агента)

Ты работаешь **над харнесом `rationaldev`** — AI-first рациональный SDLC на агентах `izi`. Контекст
проекта, принятые решения и статус — в [`CLAUDE.md`](./CLAUDE.md) (то же для claude-раннера). Концепция —
[`CONCEPT.md`](./CONCEPT.md), процесс — [`docs/00_PROCESS.md`](./docs/00_PROCESS.md).

## Единый источник дисциплин — скиллы (`skills/lib/*`)

Все инженерные дисциплины живут в **скиллах** — не дублируй их прозой здесь (раньше этот файл был
монолит-манифест; он отрефакторен в модульные скиллы, а дублирование давало дрейф). Роли/доки **референсят**
скилл, а не пересказывают. Карта «дисциплина → скилл»:

| Дисциплина | Скилл(ы) |
|---|---|
| Документация как продукт (JTBD), README, **pipe-описание API/команд**, doc-структура | `documentation`, `doc-quality-review`, `md-formatting` |
| Лендинг платформы / concept-уровень | `platform-landing` |
| Требования → измеримый BRD/FRD | `requirements-intake` |
| Вертикальные слайсы, флоу разработки | `vertical-slices` |
| Проектирование модулей, дерево, head-труба, C4, архитектура | `program-design`, `c4`, `architecture`, `domain-modeling` |
| Cockburn use-cases | `cockburn-use-case` |
| Контракт-first — OpenAPI / AsyncAPI | `openapi-spec`, `asyncapi-spec` |
| Реализация (valid-by-construction, ROP, формальная корректность) | `program-implementation`, `code-style` |
| Тесты чёрного ящика (`1 + Σ`, стабы) | `component-tests` |
| Контракт-тесты между сервисами | `contract-tests` |
| io-адаптеры (входные / исходящие) | `http-io`, `queue-io`, `db-io`, `db-schema`, `cli-io`, `llm-client` |
| Наблюдаемость (4 сигнала, канарейка) | `observability` |
| Безопасность / конфиг / секреты | `security` |
| Git — TBD, коммиты, PR | `git-conventions` |
| Тикеты реализации, target-shape, scaffold | `implementation-ticket-writer`, `target-profiles`, `service-scaffold` |
| Память / коммуникация агента | `memory`, `communication` |

Реестр и загрузка скиллов — `skills/lib/` (индекс генерит `harness/gen-skill-index.mjs`).

## Рабочие правила (в этом репо)

- Рутина (файлы, бэклог) — без остановки; **перед `git commit`** — покажи результат, жди подтверждения.
- На дефолтной ветке сначала **ветвись** (`feat/<name>`), один PR в `main` за шаг; **в `main` не мержи** —
  это делает человек через PR. Коммиты/PR — по скиллу `git-conventions`.
- Деструктив (удаление файлов, смена API-контракта) — явное подтверждение.
- Человеческие гейты обязательны; рабочая память — `.agent/memory.md` (скилл `memory`).

Статус / принятые решения / следующий шаг — [`CLAUDE.md`](./CLAUDE.md).
