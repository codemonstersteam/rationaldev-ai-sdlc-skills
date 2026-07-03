# BACKLOG — улучшения харнеса (единый индекс)

> Единственный актуальный список тикетов улучшения харнеса rationaldev. Детали каждого — в своём
> файле `docs/features/<slug>.md`. Доменные скиллы (canary/security/contract/…) — отдельный бэклог
> [`../../SKILLS-BACKLOG.md`](../../SKILLS-BACKLOG.md). Исходный вижн — [`impruvment-plan.md`](./impruvment-plan.md)
> (история; staged-planning из него уже реализован — роли `wirth-*`).
>
> Приоритет опирается на [`../agent-best-practices.md`](../agent-best-practices.md) §«Главный вывод»:
> две флагманские отраслевые недоработки харнеса — **(1) progressive disclosure** и **(2) eval-слой**.

## Статус тикетов

| # | Тикет | Приоритет | Статус | Деталь |
|---|-------|-----------|--------|--------|
| #40 | Progressive disclosure скиллов (тела по требованию) | 🔴 P0 (флагман 1) | ✅ **закрыт** по осн. критерию — встраивание −34.6% | [progressive-disclosure-skills.md](./progressive-disclosure-skills.md) |
| #39 | `expectedTicketSkills` — валидатор `skills:` тикета | 🔴 P0 | ✅ по сути готов (`harness/lib/validators.mjs:13`) | — |
| **#42** | **Trajectory / eval-слой (LLM-as-judge поверх `run-summary`)** | 🔴 P0 (флагман 2) | ✅ **закрыт по ядру** — детекторы+судья+RUNBOOK/CI; хвост (live-прогон) общий с #40/#43 | [eval-trajectory-layer.md](./eval-trajectory-layer.md) |
| #43 | Preload ядер скиллов в system + prompt-кэш | 🟡 P1 | ⏸ заведён, вторичный/кэш-зависимый; блокирован своей Фазой 0 | [skill-preload-cache.md](./skill-preload-cache.md) |
| #41 | Хуки-напоминания (`category-skill-reminder`) | 🟡 P1 | ⏳ не начат; сцеплен с #43 | — |

## Что дальше (порядок)

1. **Live sandbox-прогон** — общий хвост #40/#42/#43: закрывает (а) полное «успех»-измерение eval по
   снапшоту `.agent/**`, (б) before/after качества дробления #40, (в) Фазу 0 #43 (кэш-брейкпоинт).
2. **#43 preload+кэш** — после live-прогона (проверить `cache_control`); только GLM-роли.
3. **#41 хуки** — вместе с #43 (подстраховка слабой модели).
4. Доменные скиллы P0 из [`SKILLS-BACKLOG.md`](../../SKILLS-BACKLOG.md) — задачи доменных команд.

## Баги (найдены на live-прогонах)

| Баг | Статус | Суть |
|---|---|---|
| **izi: Glob не видит `.agent/` артефакты** | ✅ исправлен | Glob-тул opencode не заходит в скрытые (dot-)каталоги (`dot:false`); харнес пишет артефакты в `.agent/`. izi проверял наличие артефакта через `glob "**/frd.md"` → `No files found` при существующем файле → **ложный ретрай этапа** (найдено на live-прогоне, подтверждено flow.jsonl). Фикс: izi проверяет только по **зашитому пути** через `read`/`ls`, `glob` для артефактов запрещён (izi.md переписан на англ. + мандатные MUST). Класс дефекта — ровно то, что ловит eval-слой #42. |
| **Нет git-workflow в песочнице** | ⏳ TBD | Роли по дизайну не делают git (ветки/коммиты/PR — «уровнем выше, TBD»); песочница — scratch-дерево без ветки. Если нужна реализация на feature-ветке — это отдельная задача (module-development entry point). |

## Завершённое (для истории)

- **#40** — 6 топ-скиллов раздроблены на ядро + companion, лаконизированы; замер
  [`../../experiments/token-bench/skill-embedding-after-phase4.md`](../../experiments/token-bench/skill-embedding-after-phase4.md);
  enabler `opencode --agent <role>`. Ветка `feat/skill-progressive-disclosure`.
