# foreign-designer-lane — дизайн модулей ченджа для foreign-лейна 🔴

> Расширение [`route-foreign-lane`](./route-foreign-lane.md): врезать в foreign-лейн стадию **дизайна нового
> кода ченджа** (module tree + контракты + взаимосвязи + C4 + ADR) — новой ролью **`@foreign-designer`**
> (izi-имя **Parnas**). Строгий `@wirth-moduledesigner` и строгие design-скиллы — **байт-в-байт нетронуты**.

## Гэп и синтез
Foreign-лейн идёт `change-intake → ticketer` напрямую — **дизайна нового кода нет**. Для реальной фичи
(не тривиального клона-соседа) это даёт плохую декомпозицию, нет взаимосвязей/ADR/C4 → «проектирование
фичи очень плохо». Синтез (без противоречия conform):

> **Существующий код — conform** (не рефакторим). **Новый код ченджа — ПРОЕКТИРУЕМ** в конвенциях репо.

Проектировать добавляемое — не impose (мы не насаждаем структуру на чужой код, а хорошо проектируем новое).
Обоснование декомпозиции — **модульность как свойство дизайна** (Parnas: один модуль = один секрет; Wirth:
единица, тривиально реализуемая), **модель-агностично** (не «слабый исполнитель не потянет»).

## Решения (с оператором)
- **Роль:** новая `@foreign-designer` (izi-имя **Parnas** — information hiding). Отдельная, а не body-ветка
  строгого `@wirth-moduledesigner`: тот greenfield-тяжёлый (frozen-контракт, слайсы, C4 C3) — foreign-ветка
  раздула бы его и тащила бы foreign-оговорки в каждый строгий дизайн → дилюция ядра. Прецедент сплита —
  `hughes`/`hughes-rework`.
- **Тонкая роль, дисциплина в общих скиллах:** грузит `program-design`/`c4`/`domain-modeling`, применяет их
  в **conform-режиме** своей прозой. Логика не дублируется, строгие скиллы не тронуты.
- **Триггер:** дизайн-стадия — при **новых модулях/логике** ченджа (признак от change-intake); чистый
  sibling-clone/тривиальная дельта → пропуск.
- **Проекционность:** пропорционально — фича → полный `tree+contracts+C4+ADR`; мелочь → минимум (ADR sparingly).

## Новый FOREIGN-flow
```
surveyor → change-intake (дельта + признак «новые модули?»)
        → @foreign-designer (Parnas): дизайн модулей ченджа        ← ВРЕЗКА (условная по триггеру)
        → wirth-ticketer (один тикет = один узел module-tree)
        → wirth-planner → mills → Gate #1 → git-hand
        → wirth-tester(conform)/@hughes-rework → fagan(verification) → terminal → Gate #2/3
```

## `@foreign-designer` (Parnas)
- **In:** `@surveyor`-карта (конвенции) + `change-delta` + затронутый код. **Antecedent — карта**, не frozen
  openapi (нет `validate-contract-frozen`).
- **Out (durable `docs/foreign/<slug>/`):**
  - `module-tree.md` — модули ченджа + head-pipe декомпозиция, **в пакетах репо** (не `internal/<slug>/`);
  - `contracts.md` — на модуль: antecedent/consequent + **нативные io-точки** (не harness-таксономия);
  - `c4.md` — компоненты ченджа + **рёбра к СУЩЕСТВУЮЩИМ модулям** (взаимосвязь/консистентность);
  - `adr/` — несущие решения, sparingly.
- **Консистентность/логика:** дерево ↔ контракты сходятся (consequent ⊆ antecedent).
- **Проектирует ТОЛЬКО новое/изменённое**; существующий код — контекст (C4 рисует рёбра, не редизайнит).

## Тикеты
| # | Что | Файлы | Ядро |
|---|---|---|---|
| **F1** | роль `@foreign-designer` (conform-дизайн; Out=`docs/foreign/`; C4-рёбра к существующему; ADR) + register (ORDER/PIPELINE+инлайн/closed-set/gen-skill-index) + врезка в izi FOREIGN-path | new `_shared/foreign-designer.md`, `gen-agents.mjs`, `enforcement/shared.mjs`(+плагин-инлайн), `_shared/izi.md`, `guardrail-sync` | нет (аддитивно) |
| **F2** | change-intake foreign: признак «новые модули/логика» (триггер) → дизайну | `_shared/change-intake.md` | foreign-ветка |
| **F3** | ticketer foreign: тикеты **ИЗ дизайна**, один = узел module-tree (заменяет эвристику #84 настоящим деревом) | `_shared/wirth-ticketer.md` | foreign-ветка |
| **F4** | mills foreign: апгрейд ревью — дерево/контракты (consequent⊆antecedent) + C4 + ADR (не «light») | `_shared/mills.md` | foreign-ветка |
| **F5** | docs (этот эпик + `route-foreign-lane`) + smoke (@foreign-designer в closed-set, регистрация) | `docs/features/*`, `guardrail.smoke.ts` | — |

**Порядок:** F1 → F2 (триггер) → F3 (ticketer из дерева) → F4 (mills) → F5 (docs+smoke). Каждый — своя ветка/PR, зелёный smoke.

**Статус — эпик РЕАЛИЗОВАН.** F1 (#88) роль `@foreign-designer` + врезка izi 2.5 + register · F2 (#89)
change-intake `design=needed|skip` · F3 (#90) ticketer из module-tree (один=узел) · F4 (#91) mills ревьюит
дерево/контракты/C4/ADR · F5 (docs). Дизайн-стадия прошита: `change-intake` сигналит → izi роутит
`@foreign-designer` (Parnas) на `design=needed` → `docs/foreign/<slug>/{module-tree,contracts,c4}.md`+`adr/` →
ticketer режет один тикет/узел → mills ревьюит consequent⊆antecedent. **Хвост:** live-прогон на реальной фиче.

## Риски
| # | Риск | Митигация |
|---|---|---|
| 1 | Дизайн-стадия удорожает тривиальный чендж | Триггер «новые модули» (F2); проекционность |
| 2 | `@foreign-designer` навяжет harness-структуру (Go/internal-slug/openapi) | Роль-проза: «пакеты репо, нативный io, без frozen-контракта»; строгие скиллы применяются в conform |
| 3 | Новая роль = машинерия (ORDER/PIPELINE/closed-set) | Аддитивно, по образцу `@surveyor` — изолировано от строгих |
| 4 | C4/ADR для чужого стека (Spark-джоб) — форма неочевидна | F1 задаёт conform-форму C4 (компоненты репо); ADR по `domain-modeling` |

## Инвариант
Строгие `@wirth-moduledesigner` + `program-design`/`c4`/`domain-modeling` — **нетронуты**. Все foreign-ветки — в теле foreign-ролей по `mode`.
