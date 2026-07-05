# slice-aligned-code-layout — раскладка кода по срезам как принцип проектирования (ВСЕГДА) 🔴

> **Принцип:** vertical slice — не только единица планирования, но и **граница пакета**. Каждый срез
> владеет своей папкой `internal/<slice>/…` (package-by-feature / «screaming architecture»). Это **must,
> всегда** — включая single-slice. Слайс = папка = bounded context (спайка с [`domain-context-adr-layout`](./domain-context-adr-layout.md)).

## Корень (найдено на live-прогоне + чтении скиллов)

Два скилла тянут в разные стороны, и структура среза теряется в дереве кода:

- **`vertical-slices`** содержит жёсткий отказ от раскладки: *«Don't put file paths or code snippets into
  a slice (they go stale)»* + description *«Do NOT use … to write code»*. Он объявляет срезы как **work
  items**, но **не задаёт структурную границу**.
- **`program-design`** строит module-tree **per slice**, но кладёт модули в **общие пакеты по технической
  роли** (`internal/httpapi`/`catalog`/`storage`/`config`) — не под именем среза.
- **Симптом на прогоне:** `slices.md` всё равно протёк layer-keyed пакетами в прозе; module-tree дал
  `internal/{catalog,storage,httpapi,config}`. При **≥2 срезах** модули двух срезов слились бы в общие
  layer-пакеты — **граница вертикального среза не видна в исходниках**.

## Целевая раскладка (ВСЕГДА)

```
cmd/<app>/main.go              — только тонкая сборка (io: none), композирует срезы
internal/
  <slice-1>/                   — ОДИН срез = ОДНА папка = bounded context
    <гексагон среза: ingress-adapter → head+logic → Store interface ← io-adapter>
  <slice-2>/
    …
  shared/  (kernel)            — ТОЛЬКО типы, реально общие для ≥2 срезов (CustomerId, Money);
                                 появляется ЛЕНИВО, при втором срезе. Ни один срез не импортирует
                                 внутренности другого.
```

Внутренность `internal/<slice>/` — это ровно то, что уже строит `program-design` (head-pipe, ports-adapters);
меняется **корень**: не `internal/<роль>/`, а `internal/<slice>/<роль>/`.

**Single-slice тоже под именованной папкой** (консистентность + нулевой рефактор при добавлении 2-го среза).
`shared/` при одном срезе не нужен.

### Канон slug — `internal/<slug>/` (решено)

Корень среза — **`internal/<slug>/`**, БЕЗ литерального сегмента `slice/`. Не `internal/slice/<name>/`
(короче, чище «screaming architecture», совпадает с таблицей Before/After ниже). В скиллах уже разбросан
старый вариант `internal/slice/<name>/` — он **мигрирует** на `internal/<slug>/` (см. карту протечек, класс B).
Один и тот же `<slug>` — имя папки = пакет = префикс тикетов = тег component-тестов (единая identity среза,
закрывает разрыв связности «один slug сшивает всё»).

## Фикс по скиллам

### 1) `vertical-slices` (wirth-slicer) — задаёт границу, не проектирует дерево
- **Убрать** запрет *«Don't put file paths … они устаревают»* в части корня пакета. Детальные файл-листы/
  сниппеты по-прежнему НЕ кладём (те правда устаревают) — но **корень среза стабилен = это identity среза**.
- **Новое hard-правило (MUST):** каждый срез backlog'а **обязан объявить свой package root** `internal/<slice-slug>/`
  (поле `Owns package:`). Слайсер задаёт **границу**, program-design её **наполняет**.
- **Anti-example (WRONG):** модули по роли в корне `internal/httpapi`, `internal/catalog`. **RIGHT:**
  `internal/list-services/{httpapi,catalog,storage,config}`.
- Остаётся: не проектировать module-tree (это `program-design`) — только объявить папку-владельца.

### 2) `program-design` (wirth-moduledesigner) — раскладка по срезу ВСЕГДА
- **`program-design` уже частично slice-aligned:** `reference/step-03-module-tree.md:37` объявляет срез
  как `internal/slice/<name>/`. Задача — не внедрить с нуля, а **канонизировать** (`internal/<slug>/`, снять
  сегмент `slice/`) и **заткнуть протечку**, из-за которой live-прогон всё равно дал `internal/{catalog,storage,httpapi,config}`.
- **Первоисточник протечки — `step-03-module-tree.md:50-52`** (дословно):
  > Cross-cutting things (report/response types, autonomous I/O objects, shared egress) go in shared packages
  > (`internal/{domain,io,cli}`), **not in the slice**.

  Этот escape-hatch уводит I/O-объекты, доменные типы и egress в **layer-keyed** пакеты `internal/{domain,io,cli}`.
  Переписать: по умолчанию **всё живёт в `internal/<slug>/`**; в `internal/shared/` уходят **только типы**,
  реально общие для ≥2 срезов (`CustomerId`, `Money`) — не I/O-объекты и не egress-по-умолчанию.
- **Новое hard-правило (lesson-style): «Slice-aligned layout — ALWAYS».** Module tree среза **рутится**
  в объявленный `internal/<slug>/…`; **node→file map обязан** префиксовать все пути этим корнем.
- Кросс-срезовое переиспользование — **только** через явный `internal/shared/` и только для типов ≥2 срезов;
  срез не импортирует внутренности другого среза.
- `cmd/<app>/main` — единственное место композиции срезов (тонкая проводка).

### 3) I/O-скиллы + ticket-template — I/O-адаптер живёт В СРЕЗЕ
- **Несогласованность (сама по себе баг):** `llm-client/SKILL.md:15` уже кладёт `internal/slice/<name>/io.go`
  **внутрь среза**, а `db-io/SKILL.md:67`, `queue-io/SKILL.md:63`, `http-io/SKILL.md:142` — в общий `internal/io`.
  Одна дисциплина «autonomous I/O object», два разных корня. Выровнять **на in-slice**: I/O-адаптер среза →
  `internal/<slug>/io.go`; общий `internal/io` только для инфры, реально разделяемой ≥2 срезами (одно
  broker-соединение), и тогда через `internal/shared/`.
- **`program-design/reference/ticket-template.md`** — `internal/io/<dep>.go` (стр. 75), `internal/cli/cli.go`
  (стр. 61, 79): пути тикетов префиксовать `internal/<slug>/`; wiring слайса — в его папке, не в общем `internal/cli`.
- **`program-implementation/SKILL.md:205-215`** — grep-инварианты по `internal/slice/*/` перевести на `internal/<slug>/`.

## Карта протечек (все места, где раскладка уходит НЕ в срез)

Найдено `grep`-ом по `skills/`. **Класс A** — истинные протечки (код в layer-keyed shared, `not in the slice`).
**Класс B** — рассинхрон канона (`internal/slice/<name>/`, уже slice-aligned, но лишний сегмент `slice/`).

| Файл:строка | Что течёт | Класс | Фикс |
|---|---|---|---|
| `program-design/reference/step-03-module-tree.md:50-52` | cross-cutting → `internal/{domain,io,cli}`, «not in the slice» | **A** | всё в `internal/<slug>/`; `shared/` только типы ≥2 срезов |
| `db-io/SKILL.md:67` | «autonomous object in `internal/io`» | **A** | I/O-адаптер среза → `internal/<slug>/io.go` |
| `queue-io/SKILL.md:63` | «autonomous object in `internal/io`» | **A** | то же |
| `http-io/SKILL.md:142` | «all I/O in `internal/io`» | **A** | то же |
| `program-design/reference/ticket-template.md:75` | `internal/io/<dep>.go` | **A** | `internal/<slug>/io.go` |
| `program-design/reference/ticket-template.md:61,79` | `internal/cli/cli.go` wiring | **A** | wiring в папке среза (или `cmd/<app>/main`) |
| `program-design/reference/step-03-module-tree.md:37` | `internal/slice/<name>/` | B | → `internal/<slug>/` |
| `program-design/reference/ticket-template.md:70,72,76,77,78` | `internal/slice/<name>/*.go` | B | → `internal/<slug>/*.go` |
| `program-implementation/SKILL.md:205,209,212,215` | grep по `internal/slice/*/` | B | → `internal/<slug>/` |
| `llm-client/SKILL.md:15,211` | `internal/slice/<name>/…` | B | → `internal/<slug>/` (корень уже in-slice ✅) |
| `http-io/SKILL.md:189` | `gofmt … internal/slice/<name>/` | B | → `internal/<slug>/` |

**Легитимный shared (не протечка):** `program-design/SKILL.md:94` + `step-12-handoff.md:12` — cross-cutting
инфра со своей карточкой/контрактом. Оставить, но маршрутизировать в **`internal/shared/`** (тип/узел ≥2 срезов),
не в layer-keyed `internal/{io,cli}`.

## Enforcement (детерминизм — в духе харнеса) ✅ реализовано
- **`validate-layout.mjs`** (чистое ядро `validateLayout` + `validateSliceDeclarations` в `lib/validators.mjs`):
  каждый путь модуля/компонента (из node→file map / DoD-тикета) **обязан** лежать под `internal/<slug>/` среза
  **или** под объявленным `internal/shared/`. Layer-keyed корень (`internal/<роль>/`, не совпадающий со slug —
  вкл. канонические протечки `internal/{io,cli,domain,httpapi,catalog,storage,config}`) = **blocker**. Два
  режима: `--declarations` (объявлена ли граница) и paths (conform ли пути). 14 юнит-тестов (happy + каждая
  ветка-blocker). Делает «always must» **машинно-проверяемым**, не прозой (принцип [[mills-mechanical-vs-semantic]]).

- **Shift-left лестница (4 точки — ловим протечку там, где путь рождается, а не только на ревью):**

  | Рунг | Роль | Режим (consequent) | Что ловит |
  |---|---|---|---|
  | 1 | `wirth-slicer` | `--declarations` | граница `Owns package: internal/<slug>/` **названа до дизайна** (нет поля / кривое / layer-keyed) |
  | 2 | `wirth-moduledesigner` | paths | layer-keyed протечка в node→file map — **чинится в источнике, автором** |
  | 3 | `wirth-ticketer` | paths | layer-keyed путь, вписанный руками в DoD-строку тикета |
  | gate | `mills` | paths (antecedent) | финальный ров перед Gate #1 (defense-in-depth) |

  Fix-at-source вместо catch-at-review: до mills доходит уже почти всегда чистая раскладка → короче цикл
  переработки, дешевле самая дорогая-за-минуту фаза планирования.

## Before / After (из реального прогона)

| Было | Станет |
|---|---|
| `internal/catalog/…` | `internal/list-services/catalog/…` |
| `internal/storage/…` | `internal/list-services/storage/…` |
| `internal/httpapi/…` | `internal/list-services/httpapi/…` |
| `internal/config/…` | `internal/list-services/config/…` |
| `cmd/app/main.go` | `cmd/app/main.go` (без изменений — проводка) |

## Приёмка
- Мульти-слайс задача: каждый срез — своя `internal/<slice>/`; **ноль** перекрёстных импортов между срезами;
  общее — только явный `internal/shared/`.
- Single-slice: код под именованной `internal/<slice>/` (не layer-keyed корень).
- `validate-layout` ловит layer-keyed раскладку как fail; чистая slice-aligned → exit 0.
- `vertical-slices` больше **не** запрещает раскладку — а **предписывает** package root среза.
- **Все протечки из карты закрыты:** `grep -rE 'internal/(slice|io|cli|domain|httpapi|catalog|storage|config)/' skills/`
  не находит layer-keyed корней (кроме легитимного `internal/shared/`); I/O-адаптер среза — в `internal/<slug>/io.go`,
  а не в общем `internal/io`; канон везде `internal/<slug>/` (ни одного `internal/slice/<name>/`).

## Связи
Чинит `vertical-slices` (задаёт структуру) + `program-design` (раскладка по срезу — always). Спайка с
[`domain-context-adr-layout`](./domain-context-adr-layout.md): слайс = папка = bounded context (там же
`CONTEXT.md`/`docs/adr/` контекста). Родственно `harden-decomposition` (детерминированный гейт против
дисциплинарной протечки) и `mills` per-ticket walk.
