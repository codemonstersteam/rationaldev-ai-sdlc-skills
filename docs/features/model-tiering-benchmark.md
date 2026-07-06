# model-tiering-benchmark — выбор моделей по ролям (router/tiers) через бенчмарк 🟡

> **Цель:** заменить текущий сетап моделей на обоснованный бенчмарком, отдельно для **роутера** (izi) и
> тиров. Сначала — эта аналитика (кандидаты + что мерить), потом — прогоны и выбор. Родственно
> [`planning-cost-model-tiering`](./planning-cost-model-tiering.md) (тот про удешевление лёгких Wirth-ролей;
> здесь — про **надёжность роутера** + свежие модели середины 2026).

## Проблема (найдено на live-прогоне 04–05.07.2026)

Текущий сетап (`harness/models.config.json`): large=**GLM 5.2**, medium/small=**Qwen3.6-27b**, **izi (router)=Qwen3.6-27b**.

На прогоне переработанного харнеса izi (Qwen) дал **две деградации**, не косметические:
1. **Кривые tool-call'ы** — `⚙ invalid` / `⚙ unknown` («Model tried to call unavailable tool»): Qwen плохо держит строгий формат вызова → ретраи, подъедание вызовов.
2. **Мис-роутинг** — тикеты 6–8 не дописал ticketer, izi попытался делегировать их **@hughes (имплементеру!)** → **guardrail корректно заблокировал** (реализация до Gate #1) → izi обошёл через непрофильный **@general**. Роутер выбрал не ту роль на задачу.

**Вывод:** роутер — это **спина** прогона; ему нужна **надёжность tool-calling + инструкций** при низкой
цене/латентности, а НЕ интеллект. Qwen3.6-27b на этой роли нестабилен.

## Требования по классам ролей

| Класс | Роли | Что критично | Что НЕ критично |
|---|---|---|---|
| **Router** | izi | надёжный tool-call, строгое следование фикс-последовательности, низкая латентность/цена (вывод крошечный) | глубокий reasoning |
| **Дизайн/суждение** | wirth-*, mills | качество плана, tool-стабильность на многошаге | цена (вывод мал, но контекст большой) |
| **Реализация модулей** | hughes | код по тикету, tool-use; дёшево (много вызовов) | — |

## Кандидаты (веб-обзоры mid-2026 — проверить доступность на нашем OpenRouter-прокси)

| Модель | Класс/сила | Цена/скорость | Фит |
|---|---|---|---|
| **GLM-4.7-Flash** (Z.ai) | 30B, tool-calling из GLM-семейства | **$0.06/$0.40** за M, Flash-скорость, местами free | **Router (izi)** — «GLM, но быстрее»; кандидат на small-тир |
| **Qwen3.6 Plus / Flash** | наследник нашей линии, 1M ctx, **надёжный tool-use**, ≈2–3× tok/s | средняя | small/medium-тир вместо 3.6-27b |
| **Kimi K2.6 / K2.7** (Moonshot) | ~1T MoE, **лидер агентной стабильности** (recoverable failures, consistent tool-calling на длинных сессиях); K2.7 Code −30% think-токенов | дороже, жирнее | точечно на **тяжёлые tool-use роли** (mills/moduledesigner); оверкилл для router |
| **DeepSeek V4 Pro** | frontier-substitute, млн-токенные трассы | **$0.435/$0.87**, near-free cache | если ось = юнит-цена на длинном контексте |
| GLM 5.2 (текущий large) | raw intelligence, long-horizon | дороже Flash | оставить на дизайне, если Kimi не зайдёт |

## Гипотеза сетапа (валидировать бенчмарком, НЕ принимать на веру)

- **izi → GLM-4.7-Flash** (главное — чинит мис-роутинг/шум дёшево).
- **small/medium → Qwen3.6 Plus/Flash** или **GLM-4.7-Flash** (сравнить).
- **mills / wirth-moduledesigner → кандидат Kimi K2.7** (максимум tool-стабильности на многошаге) vs GLM 5.2.
- **large (дизайн) → GLM 5.2** удержать как baseline, челленджить Kimi/DeepSeek.

## План бенчмарка

1. **Метрики** (на bench-задаче `services-by-platform`, через token-прокси + `run-summary.mjs`):
   - **tool-call error rate** (`invalid`/`unknown` на экране/в flow.jsonl) — прямой индикатор нестабильности роутера;
   - **mis-route rate** (делегирование не той роли; guardrail-блоки);
   - **drop-rate** тяжёлых тикетов (напр. wiring — Qwen ронял ticket-07);
   - **cost $ / input+output токены** (по `usage.jsonl` `req_model`), **время до Gate #1** и полное;
   - **успех end-to-end** (`run-tests.sh` exit 0).
2. **Матрица прогонов** — фиксируем всё, меняем **одну ось за раз** (сначала izi: Qwen3.6-27b → GLM-4.7-Flash; затем small-тир; затем mills).
3. **Baseline** — текущий сетап (GLM5.2/Qwen3.6-27b). Каждый прогон — своя папка в `test-harnes-data/` (иммутабельно, [[preserve-test-measurement-data]]).
4. **Выбор** — сетап с min(mis-route + drop) при приемлемой $/времени; зафиксировать в `models.config.json` + этот док.

## Приёмка
- Выбранный сетап **побил baseline** по mis-route/drop без роста $ выше порога — с цифрами из `run-summary`.
- Каждая замена обоснована **замером**, не обзором. Доступность моделей на прокси проверена до прогона.

## Связи
Родственно [`planning-cost-model-tiering`](./planning-cost-model-tiering.md) (тиринг лёгких ролей). Источник
проблемы — live-прогон переработанного харнеса (P0 slice-aligned + P1 domain-context). Процедура прогона/замеров —
[[harness-run-driving-procedure]] + [[rational-harness-test-sandbox]].

## Источники (mid-2026, веб)
- GLM-4.7-Flash — <https://openrouter.ai/z-ai/glm-4.7-flash>
- Best Chinese LLMs 2026 (DeepSeek V4 / Kimi K2.6 / GLM-5 / Qwen) — <https://benchlm.ai/blog/posts/best-chinese-llm>
- GLM-5.2 vs DeepSeek V4 vs Qwen3 — <https://www.developersdigest.tech/blog/glm-5-2-vs-deepseek-v4-vs-qwen3-open-weights-coding-showdown>
- Qwen 3.6 Plus Preview (1M ctx, speed) — <https://www.buildfastwithai.com/blogs/qwen-3-6-plus-preview-review>
- AI Leaderboard 2026 (speed/price) — <https://llm-stats.com/>
- Qwen3.5-Flash — <https://openrouter.ai/qwen/qwen3.5-flash-02-23>
