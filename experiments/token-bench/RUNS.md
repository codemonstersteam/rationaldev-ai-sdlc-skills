# RUNS — сводная аналитика прогонов харнеса

Табличный индекс всех замеров. Детали каждого — в `run*/metrics.md` (или `EXPERIMENT.md` для ранних).
Сырьё замеров (`usage.jsonl`/`flow.jsonl`) лежит рядом с каждым прогоном и **не затирается**.

| Дата | № | Арм / конфиг | Задача | Исход | Время (excl. Gate #1) | Output tok | **$** (in+out+кэш) | Ключевая находка |
|---|---|---|---|---|---|---|---|---|
| 2026-07-03 | run4 | Харнес(OpenCode) · opus/sonnet/haiku | test0 | ✅ PASS | ≈18–20 мин | 123 352 | **≈$2.3** | база: харнес компактнее omo в ~4.5× по $ |
| — | — | omo (Ultimate) · opus | test0 | ✅ PASS | ≈28 мин | 123 761 | **$10.37** | дорого из-за впрыска контекста Sisyphus |
| **2026-07-05** | **run5** | **Харнес(OpenCode) · GLM-5.2 + Qwen3.6-27b** | task.md | ⛔ **BLOCKED @ ticket-4** | ~28 мин продукт. + ≥30 мин холостых | 237 691 | **$1.88** | «дешёвый» Qwen $1.31 > вся планировка GLM $0.535; 76% его output — 4×32K runaway на sink-тикете |
| **2026-07-05** | **run6** | **Харнес(OpenCode) · GLM-5.2 + Qwen3.6-27b** (ticketer P→Q формула) | task.md | ✅ **Gate #2** | ~1ч+ активных | 222 595 | **$2.72** | формула нарезки → **8 атомарных тикетов**, head/adapter раздельно, первый Gate #2; 2 дропаута Qwen (кривой tool-call · спираль composition) дожал @linger |
| **2026-07-06** | **run7** | **Харнес(OpenCode) · GLM-5.2 + Qwen3.6-27b** (izi module×N + design root-cause) | task.md | ✅ **Gate #2** | ~2ч (с валидацией) | 195 605 | **$2.87** | **10 атомарных тикетов, ZERO дропаутов** (впервые); корень монстра = izi-промпт `{component RED → module}` сингуляр, фикс `module×N`; sort=0 юнитов (step-08); mills поймал+исправил NFR-blocker; толстый final ~16мин но собрался |

> **Сырьё прогонов** (снапшот проекта, трасса ролей, proxy-логи, `analysis.md`/`models.md`) —
> в `../test-harnes-data/DD-MM-YYYY/N-harnes/` (локально, не коммитится). Здесь — только коммитимый синтез.

## Детали run5 (2026-07-05)

- **Полный разбор:** `../test-harnes-data/05-07-2026/1-harnes/analysis.md` (+ `models.md`, `agent-trace/`, `proxy/`)
- **Токены/деньги (scoped):** Qwen 91 req · $1.31 (70%) · GLM-5.2 110 req · $0.535 · GLM-flash(izi) 43 req · $0.035. Итого 244 req · 7.0M in · 5.63M cache (80% hit) · 237.7K out · **$1.88**.
- **Корень:** §6 pipeline — component-GREEN единый терминальный на весь слайс ⇒ `io:none` узлы (head/adapter/register) без промежуточного чекпоинта схлопываются в один тяжёлый sink-тикет (~50K контекст) ⇒ Qwen срывается в 32K-runaway / зависший стрим.
- **Осн. рекомендация:** инкрементальный component-GREEN (walking skeleton) — резать sink на тикеты с подмножеством сценариев как приёмкой. Вторично: вес-роутинг sink→GLM; предохранитель max_tokens<32K + abort зависшего стрима.
- **Что подтвердилось хорошо:** 7 валидаторов зелёные, mills-семантика корректна, A1 (счёт юнитов 8) запинен и реализован 8+5 green; domain/Store (ticket-2/3) Qwen сделал чисто — модель не виновата, виноват неатомарный sink.

## Детали run6 (2026-07-05, финиш 06-07)

- **Полный разбор:** `../test-harnes-data/05-07-2026/2-harnes/analysis.md` (+ `models.md`, `agent-trace/`, `proxy/`)
- **Конфиг:** ticketer с **формулой нарезки P→Q** (`f362b3b`) — слайс нарезан на **8 атомарных тикетов**, head/adapter раздельно. Первый прогон сессии до **Gate #2**.
- **Токены/деньги (scoped):** GLM-5.2 237 req · $1.38 (кэш 90%) · Qwen 92 req · $1.28 (кэш ~1%) · GLM-flash(izi) 72 req · $0.06. Итого 401 req · 13.0M in · 9.16M cache (70%) · 222.6K out · **$2.72** (cost-per-success $2.72).
- **Качество:** модули отличные (head-pipe, error-mapping 503/422/500, slice-aligned `internal/services-catalog/` — validate-layout OK). Дефект: scaffold-placeholder `cmd/app/main.go` + `internal/shared/config` не удалены → dead-code дубль entry-point/config (реальный `cmd/services-by-platform` собирается везде, build/тесты green).
- **2 дропаута Qwen** (оба дожал @linger): ticket-07 adapter — кривой tool-call (`'unknown'` тул); ticket-08 final — спираль чтения (35 read, 46K) из-за «no contract» composition root.
- **Фиксы из прогона (`da8792f`, со след. прогона):** composition root = модуль с контрактом (step-03); final MUST нести путь+команду харнеса, модульный Verify без component-прогона (reference). Открытый трек: tool-call флаки Qwen.

## Что мерить (методология, из EXPERIMENT.md)
Стоимость — по **total $ (input+output+кэш) на завершённую задачу**, не по output-токенам.
Плюс: cache-хит, рост контекста/шаг, cost-per-success, success-rate, микс моделей по тирам,
предохранители (лимиты токенов/шагов, abort стрима), N прогонов на недетерминизм.
