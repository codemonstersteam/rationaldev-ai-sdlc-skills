<!-- program-design · step 12 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 12. Fill in the handoff checklist

**In:** the finished design package and backlog. **Out:** the `[x]`-filled handoff checklist in `backlog.md` + an open design PR.

#### Conformance-gate (STOP before handoff)

Before filling the checklist — mechanically run **all** the skill's hard rules; any violation =
**STOP**, return to the right step, handoff forbidden.

1. **Cross-cutting infrastructure has its own card and contract.** A cross-slice node (shared
   egress, shared `Request` fields/flags, `infrastructure.md`) **must** have a design card and a
   contract and pass every reconciliation — it doesn't "fall between the slices". A cross-slice
   node without a card/contract → STOP (the direct root of D1: the shared egress had no card → no
   conformance checks ran on it).
2. **Consolidated checklist of hard rules** — run over all slices: single `Request` (Step 3);
   one data argument (Step 3); I/O isolation, no raw `*sql.DB`/`*http.Client` (Step 5/6); no
   test-only I/O method (Step 3); branch = logic, not a component scenario (Step 3/8.1); C4 by
   levels (Step 3); error dictionary (Step 4); UC↔scenario traceability,
   `#component_failure_scenarios == #distinguishable_I/O-adapter_branches`, input-validation
   Extensions → units (Step 8.6); every module contract carries `io:` (Step 5); Gherkin-mapping
   (Step 8.4); contracts graph (Step 9).
3. **Asymmetry.** Conformance is checked by `plan-reviewer` against this skill as the reference
   standard — not just Step 12's self-fill.

**Anti-gaming:** you **MUST NOT** tick `[x]` without an existing artifact.

The last step before opening the design PR. The checklist goes at the top of
`.agent/planner/design/<slug>/backlog.md` (section `## Хендофф`). The planner fills **all** the
`[x]` ticks themselves — including the last approval line — verifying that the corresponding
artifact actually exists and contains what's required.

**Format of the operator approval mark.** The planner fills the last line with the operator's
handle and the **design-PR creation date** in a strict format:

```
- [x] Оператор аппрувит пакет — @<github-handle>, <YYYY-MM-DD>
```

For example (design PR created 2026-05-10): `- [x] Оператор аппрувит пакет — @maxmorev, 2026-05-10`.

**Semantics: merging the design PR into main = the operator approving the package.** The
operator expresses agreement with the design by the act of merging the PR: if they agree — they
merge, and the pre-filled `[x]` line stays in main; if they disagree — they leave the PR open
with comments, the planner reassembles the package and, if needed, updates the line's date to
the next push date. There is **no** separate "operator flips the tick after merge" ceremony.

This line is the only deterministic sign by which the implementer recognizes "package accepted"
in main (see `program-implementation` Step 0). If the line in main is `[ ]` or missing — the
implementer doesn't start.

If the operator demands substantial changes and review drags on — the planner may temporarily
return the line to `[ ]` while the package is reworked, so a casual reader isn't misled. At the
moment of the final push before merge — `[x]` again.

```
## Хендофф-чеклист (заполняет проектировщик полностью; merge PR = аппрув оператора)

- [x] OpenAPI / AsyncAPI зафиксирован, все эндпоинты slice'ов в нём описаны
- [x] OpenAPI / AsyncAPI содержит 5xx-ответы с `error.code` для каждого режима отказа
- [x] README содержит таблицу «Карта режимов отказа» (HTTP-статус / тип события / заголовки, действие клиента, действие оператора)
- [x] **Компонентные сценарии Gherkin для эндпоинтов всех slice'ов написаны, закоммичены, стабильны (один happy + сценарий на каждый различимый режим отказа)**
- [x] Папка .agent/planner/design/<slug>/ создана и полна
- [x] intent.md — задача в одну фразу
- [x] slices.md — таблица срезов с типом входа, идентификатором, назначением
- [x] messages.md — все структуры данных и Result<T, Error>
- [x] Для каждого slice'а есть отдельный файл с деревом модулей
- [x] У каждого slice'а описан головной модуль (оркестратор пайпа)
- [x] У головного модуля каждого slice'а зафиксирован псевдокод пайпа исполнения (5–10 шагов)
- [x] **Раскладка каждого slice'а по конвенции: head.go (голова `Process<Slice>`), adapter.go / logic.go / domain.go / errors.go / register.go; голова экспортируется напрямую, не за обёрткой (Шаг 3)**
- [x] У каждого модуля логики описаны антецедент и консеквент
- [x] У каждого I/O-модуля slice'а описан контракт и режимы отказа
- [x] **У каждого модуля Input — одна доменная структура / DTO / void; deps вынесены отдельной строкой `Dependencies:` (Шаг 5). Узлов с 2+ data-аргументами в графе нет**
- [x] **I/O-зависимости (БД, HTTP, брокер, файловая система) инкапсулированы в автономный объект `Store`/`Client`/`Publisher`/`Consumer`/`FileStore` (Шаг 6). Сырых `*sql.DB`, `*http.Client`, broker-conn в `Dependencies:` контрактов модулей и в `Deps` головного модуля нет — они скрыты внутри I/O-объекта (Шаг 5, чек-лист `Dependencies:`)**
- [x] **Карточка каждого slice'а содержит таблицу `## Gherkin-mapping`: каждый Then-шаг каждого сценария slice'а привязан к узлу графа или маппингу адаптера (Шаг 8.4)**
- [x] **contracts-graph.md существует, граф каждого slice'а согласован (все стрелки помечены `[x]`, в т.ч. пункт 5 о покрытии Gherkin-сценариев)**
- [x] **`c4.md` есть: C2 (контейнер) + C3 (дерево модулей) на Mermaid; C3 совпадает с деревом Шага 3; C1 — на лэндинге (Шаг 3 «C4 по уровням»)**
- [x] **Системный use case по Коберну зафиксирован; `#Extensions == #сценариев_отказа == #кодов_ошибок` среза (Шаг 8.6, gate-сверка в обе стороны)**
- [x] **Модель ошибок в `messages.md`: словарь кодов + маппинг код→exit/HTTP + правило «деградация видна» (Шаг 4)**
- [x] **Единый `Request` на срез; флаги = поля `Request`; нет side-инъекций мимо `Request`; нет test-only метода I/O; развилки по полю `Request` — в юнитах, не в компонентных сценариях (Шаг 3, урок D1)**
- [x] **Сквозная инфраструктура (общий egress / флаги / `infrastructure.md`) имеет свою design-карту и контракт и прошла все сверки (Conformance-gate п.1)**
- [x] **Доки пакета созданы по скиллу `documentation` (процедуры A/B/C), не свободной прозой мимо скилла (doc-gate)**
- [x] Для конструкторов доменных структур и чистых функций логики посчитаны юнит-тесты по формуле
- [x] **В таблице юнит-тестов каждой карточки слайса нет головного модуля, нет I/O-модулей и нет ингресс-адаптера: все три — трубы, проверяются только компонентными сценариями (Шаг 8.1)**
- [x] infrastructure.md — описан инфраструктурный модуль приложения
- [x] backlog.md — тикеты по одному на slice, с зависимостями
- [x] Оператор аппрувит пакет — @<github-handle>, <YYYY-MM-DD>
```

All lines in the template above are shown as `[x]` — the norm for a merge-ready design PR. If
some item stays unclosed at push time (an explicit sub-optimal choice, a divergence from the
skill, etc.) — leave it `[ ]` and describe it in the slice card's `## Решения по дизайну`
section, so the operator sees it during review.
