# План #43 — preload ядер скиллов в system + prompt-кэш (вынесенная Фаза 3 из #40)

> Вторичный, **кэш-зависимый** рычаг экономии контекста. Выделен из [#40](./progressive-disclosure-skills.md)
> после того, как основной (провайдер-независимый) выигрыш взят Фазой 4 (−34.6% встраивания).
> Реализует вариант (c) из решения #40.

## Контекст (почему отдельно)

Разведка Фазы 3 в #40 показала: экономия от переноса тел скиллов в system-промпт держится **целиком**
на prompt-кэше провайдера. Без кэша тело биллится в каждом запросе так же, как «висящий» tool_result
(и хуже — резидентно с хода 0, а не с момента чтения). См. [`progressive-disclosure-skills.md`](./progressive-disclosure-skills.md)
§«РАЗВЕДКА ФАЗЫ 3» и память `pd-skills-phase3-cache-dependent`.

**Кэш OpenRouter (июль 2026):**
- **GLM-5.2** (large-тир: `wirth-*`/`mills` — планирование/дизайн) — **кэширует**.
- **`qwen/qwen3.6-27b`** (small/medium: `hughes`/`scaffolder`/`wirth-tester`/`izi`) — **не в списке
  explicit-cache** → префикс не кэшируется.

**Следствие для объёма:** реалистичный потолок — только **GLM-роли** (`program-design` 34.5K, `c4`
18.4K, `implementation-ticket-writer` 32.8K, + мелочь `requirements-intake`/`cockburn`/`openapi`/
`vertical-slices`) ≈ **~100K** встраивания. Доминанта `component-tests` (Qwen) сюда НЕ входит —
её уже забрала Фаза 4.

## Задача

Прокидывать `skills:` тикета в делегацию как **preload**: ядра названных скиллов класть в стабильный
префикс субагента **один раз** с `cache_control`-брейкпоинтом (аналог OMO `task(load_skills=[...])`),
вместо того чтобы роль читала `SKILL.md` повторяемым `Read`.

## Фаза 0 этого тикета — снять неопределённости ПЕРЕД кодом

0. **Уже есть нативный тул `skill`** (открыто разведкой #42: 232 вызова в прогоне — загрузчик тел).
   Значит частично path A существует. Проверить: можно ли этому тулу задать **сессионный кэш** и/или
   отдавать **ядро** (companion — по отдельному вызову), прежде чем городить preload через плагин.
1. **Ставит ли opencode 1.17 `cache_control`-брейкпоинт** на system/первое сообщение для OpenRouter?
   Без него preload бесполезен даже на GLM. Проверить по `flow.jsonl` (поле `cache_control` в
   `body`) на GLM-роли.
2. **Мутируем ли args `task` в плагине** `tool.execute.before` (`harness/enforcement/opencode/rational-guardrail.ts`)?
   Нужно уметь дописать ядра скиллов в `output.args.prompt` до делегации.

Если (1) = нет → тикет закрывается как «провайдер не поддерживает», без кода.

## Механизм (если Фаза 0 зелёная)

- В `rational-guardrail.ts` на `tool.execute.before(task)`: прочитать тикет (путь в args) → его
  `skills:` → для GLM-ролей дописать **ядра** `skills/lib/<name>/SKILL.md` в `args.prompt` + пометить
  `cache_control`. Companion НЕ преложить (грузятся по требованию — как в #40).
- Переписать тела ролей + `harness/instructions/AGENTS.opencode.md`: «грузи по имени» → «твои скиллы
  приложены к заданию; companion читай по нужде» — чтобы не было повторного `Read`.
- Ограничить preload GLM-ролями (Qwen — не кэширует, там preload = регресс).

## Критерии приёмки

- На GLM-роли во `flow.jsonl`: ядра скиллов в стабильном префиксе с `cache_control`; со 2-го запроса
  идут как **cache-read** (по `usage.jsonl`/полям кэша), не full-price.
- Замер `skill-embedding-cost.mjs` + `run-summary.mjs`: падение **cache-write** input на GLM-ролях;
  gross встраивания на них → ~0 после первого запроса.
- Qwen-роли не тронуты (preload им не применяется).
- MUST-инвариант `gen-skill-index.mjs --check` зелёный; качество артефактов не деградировало.

## Риски

- **opencode не ставит брейкпоинт** → нулевой эффект (снимается Фазой 0).
- **Слабая модель забыла, что скиллы приложены** → хук-напоминание (`category-skill-reminder`, #41).
- **Регресс на Qwen** при ошибочном применении preload → жёстко ограничить тир/роль.

## Связи

- Родитель: [#40](./progressive-disclosure-skills.md) (закрыт по основному критерию).
- Смыкается: #39 (`expectedTicketSkills` — источник `skills:`), #41 (хуки), #42 (eval качества).
- Артефакты: `harness/enforcement/opencode/rational-guardrail.ts`,
  `experiments/token-bench/runners/skill-embedding-cost.mjs`, `harness/instructions/AGENTS.opencode.md`.
