# domain-context-adr-layout — bounded-context раскладка (CONTEXT-MAP + per-slice CONTEXT.md/ADR) 🟡

> Хотим взять из внешнего скилла [`skills/engineering/domain-modeling`](/Users/mac/IdeaProjects/codemonstersdev/skills/skills/engineering/domain-modeling)
> мульти-контекстную раскладку: root `CONTEXT-MAP.md` + system-wide `docs/adr/`, и **per-context**
> `CONTEXT.md` + `docs/adr/`, со-локированные с контекстом. Ключевая идея оператора: раскладка
> **лаконична, когда весь bounded context лежит в одном слайсе** — тогда `CONTEXT.md` и решения живут
> «рядом со срезом, всё вместе».

## Развилка co-location — РЕШЕНО: B (`docs/design/slice-<slug>/`, биндинг по slug)

Где живёт slice-scoped знание (`CONTEXT.md` + `adr/`): физически в коде `internal/<slug>/` (**A**) или в
дизайн-пакете `docs/design/slice-<slug>/` (**B**). **Решено B** — по решающей оси, которую первая редакция
упустила: **жизненный цикл**. `internal/<slug>/` физически **не существует** до скаффолда (после Gate #1), а
`CONTEXT.md` рождается у **wirth-intake на планировании** — вариант A потребовал бы либо ранний `mkdir internal/`
(планировочные роли пишут в `docs/`/`.agent`, не в `internal/`), либо миграцию при скаффолде (churn — ровно
«двойная прописка», которую и лечим). 4 из 5 критериев (lifecycle, права/конвейер, консистентность с уже
существующим дизайн-пакетом, ADR) — за B; за A только эстетика «screaming architecture».

**«Всё рядом» достигается биндингом, не физическим слиянием:** один `<slug>` сшивает оба дерева —
`internal/<slug>/` (код) ↔ `docs/design/slice-<slug>/` (знание), связь через пакетный doc-comment
`internal/<slug>/` → дизайн-пакет и обратно. «Весь bounded context лежит в слайсе» истинно **логически**
(один slug = один срез = код+знание). Код vs docs — нормальный принятый раздел (C4/contracts уже так живут).
Заодно закрывает разрыв связности #2: дизайн-папку выравниваем на `slice-<slug>` (голый slug после `slice-`)
— лексический 1:1 с `internal/<slug>/` (спайка с [`slice-aligned-code-layout`](./slice-aligned-code-layout.md)).

## Что уже взято (инвентаризация скиллов проекта)

Половину внешнего `domain-modeling` проект **уже адаптировал**, но только в single-context виде:

| Концепт внешнего скилла | Взято? | Где в проекте |
|---|---|---|
| **CONTEXT.md** — ubiquitous language / глоссарий | ✅ да | `requirements-intake` (роль **wirth-intake**), Step 3 «sharpen the domain (active, domain-modeling style)» — пинит термины в `CONTEXT.md` inline, «the moment it crystallises»; провенанс прямо ссылается на «DDD ubiquitous language / event storming» |
| **CONTEXT-FORMAT** (opinionated, `_Avoid_`, tight defs) | 🟡 частично | глоссарий FRD в `requirements-intake`; строгого формата `_Avoid_`/«только термины контекста» нет |
| **docs/adr/** — ADR при значимом выборе | ✅ да | `documentation` (роли **hughes/linger**): `docs/adr/` + шаблон `docs/templates/adr.md` + README-ссылки; критерий «why a technology/pattern/structure was chosen» |
| **ADR-FORMAT** (1–3 предложения, lazy, три условия) | 🟡 частично | шаблон есть; трёх-условного «offer sparingly» (hard-to-reverse + surprising + real trade-off) в скилле нет |
| **CONTEXT-MAP.md** — мульти-контекст + Relationships | ❌ нет | проект single-service/single-context |
| **per-context co-location** (`src/<ctx>/CONTEXT.md` + `src/<ctx>/docs/adr/`) | ❌ нет | `CONTEXT.md`/ADR только в корне |

Вывод: **не хватает мульти-контекстной половины** — `CONTEXT-MAP.md` и со-локация контекст-специфичных
`CONTEXT.md`/`docs/adr/`. Плюс форматы (`CONTEXT-FORMAT`/`ADR-FORMAT`) стоит унифицировать из одного источника.

## Куда добавить: расширить существующее, НЕ новая роль

**Новая роль не нужна.** Domain modeling — **сквозная дисциплина** планирования+документирования, не
отдельная стадия конвейера: отдельная роль дала бы лишний pipeline-этап + gate-оверхед. Внешний скилл сам
это формулирует: активная дисциплина *изменения* модели, а *чтение* `CONTEXT.md` — однострочная привычка
любого скилла. В харнесе это ложится на три точки, которые уже этим занимаются:

- **Новый lib-скилл `domain-modeling`** (единый источник формата) — несёт `CONTEXT-FORMAT` + `ADR-FORMAT`
  + `CONTEXT-MAP` + правило single-vs-multi + lazy-создание + **порог «слайс = bounded context»**. По
  принципу «по одной копии» — не дублировать формат в трёх скиллах, они ссылаются на него. core+companion, ≤300 строк.
- **`requirements-intake`** (wirth-intake) — уже пинит `CONTEXT.md`; расширить: при **≥2 слайсах/контекстах**
  — per-slice `CONTEXT.md` + root `CONTEXT-MAP.md` с секцией **Relationships**; single остаётся одним root `CONTEXT.md`.
- **`vertical-slices`** (wirth-slicer) — слайсер делинеирует контексты: добавить шаг «назвать bounded
  context слайса + его связи (upstream/downstream, shared types) в `CONTEXT-MAP.md`». Слайс = контекст.
- **`documentation`** (hughes) — уже владеет `docs/adr/`; добавить правило **context-specific ADR**:
  решения, локальные контексту, → `docs/design/slice-<slug>/adr/`; system-wide → корневой `docs/adr/`.
  Трёх-условный критерий «offer ADR sparingly» и формат — **ссылкой на `domain-modeling`** (не дублировать).
- **ADR-авторство `linger` (РЕШЕНО, Ф3):** linger **тоже пишет context-specific ADR** — фиксы часто и есть
  hard-to-reverse trade-off (классический повод для ADR). **Лаконичная развязка перегруза:** в allowlist
  linger добавляем **только `domain-modeling`** (не полный `documentation`) — формат+размещение+«когда» ADR
  самодостаточны в `reference/ADR-FORMAT.md`; широкая доковая дисциплina (README/architecture.md) остаётся у
  hughes. linger: 7 → **8 скиллов** (легче hughes). `skills:` — allowlist, не преload (#40): тело грузится лишь
  при реальном ADR (редко, три-условный гейт), контекст не раздувается. hughes на Ф3 тоже получает
  `domain-modeling` (за форматом), сохраняя `documentation`.
- *(опц.)* **`program-design`** (wirth-moduledesigner) — класть `CONTEXT.md` слайса в дизайн-пакет
  `docs/design/slice-<slug>/` рядом с use-case/contracts/c4 (весь контекст-знание в одном пакете, код — по slug).

## Целевая раскладка

```
Single context (текущее, остаётся лаконичным):
/  ├── CONTEXT.md            (глоссарий)
   └── docs/adr/             (system-wide решения)

Multi context (когда контекстов ≥2 — слайс = контекст; знание в дизайн-пакете, код рядом по slug):
/  ├── CONTEXT-MAP.md              (карта контекстов + Relationships)
   ├── docs/adr/                   (system-wide решения)
   ├── internal/
   │    ├── ordering/  …код…       ← doc-comment → docs/design/slice-ordering/
   │    └── billing/   …код…
   └── docs/design/
        ├── slice-ordering/   ├── CONTEXT.md     (глоссарий контекста)
        │                     ├── adr/           (context-specific решения)
        │                     └── c4.md · use-case.md · contracts.md
        └── slice-billing/    ├── CONTEXT.md
                              ├── adr/
                              └── …
```
Биндинг: `internal/<slug>/` ↔ `docs/design/slice-<slug>/` по общему `<slug>` — один срез, два дерева
(код / знание), сшитые именем. Ни один файл не мигрирует между деревьями.

Lazy: любой файл создаётся, **только когда есть что записать** (первый резолвнутый термин / первый ADR).

## План работы (по фазам) — ✅ РЕАЛИЗОВАНО

- **Ф0** ✅ — lib-скилл `domain-modeling` (core 95 строк + companions `CONTEXT-FORMAT`/`ADR-FORMAT`); «слайс = bounded context», co-location B зашита; в `INDEX.json` (stable).
- **Ф1** ✅ — `requirements-intake` Step 3: single/multi ветка (seed root `CONTEXT-MAP` при ≥2), формат ссылкой на `domain-modeling`; `wirth-intake` несёт `domain-modeling` + output/permission `CONTEXT-MAP.md`.
- **Ф2** ✅ — `vertical-slices`: поле `Bounded context:` + секция CONTEXT-MAP (bind контекст↔slug + Relationships, ordering-оговорка); `wirth-slicer` wired.
- **Ф3** ✅ — `documentation`: ADR context-local `docs/design/slice-<slug>/adr/` vs system-wide, три-условный критерий ссылкой на `domain-modeling`; hughes + **linger (lean, только `domain-modeling`)** пишут ADR.
- **Ф4** ✅ — `validate-context-map.mjs` (+ чистое `validateContextMap`, 8 юнит-тестов): ≥2 `CONTEXT.md` ⇒ root `CONTEXT-MAP` (ссылки резолвятся, Relationships, покрытие), ADR-нумерация 1..n per dir; **мягкий** (single-context = no-op). Гейт у `mills` (S3 coverage).
- **Финал** ✅ — проекции (claude/opencode/codex + skills/roles) регенерированы; 79 тестов зелёные; smoke CLI ок; CI `--check` exit 0.

## Приёмка

- Мульти-слайс задача: root `CONTEXT-MAP.md` со связями; каждый слайс — свой `CONTEXT.md` + `docs/adr/`.
- Single-слайс задача **остаётся лаконичной** — один root `CONTEXT.md`, без `CONTEXT-MAP.md`.
- Формат `CONTEXT`/`ADR` — из **одного источника** (`domain-modeling`), не продублирован в трёх скиллах.
- Существующее поведение intake/documentation не регрессирует.

## Связи

Расширяет `requirements-intake` + `documentation`; сцеплено с `vertical-slices`/`program-design` (слайс-пакет).
Источник — внешний [`skills/engineering/domain-modeling`](/Users/mac/IdeaProjects/codemonstersdev/skills/skills/engineering/domain-modeling)
(`SKILL.md` + `CONTEXT-FORMAT.md` + `ADR-FORMAT.md`). Родственно `mills` per-ticket walk S3 (покрытие) — карта
контекстов как ещё один инвариант «ничего не потеряно».
