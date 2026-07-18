# harnes-imp.md — Улучшение харнеса для rework library-проектов

**Дата:** 2026-07-18
**Кейс-источник:** change 001 (ThriceInPlus extend-to-2027-retune-rules), ticket-01 (component, RED-first)
**Режим:** analysis + proposal (без диффов)

---

## 1. Кейс

Change 001 — rework существующей акции `ThriceInPlus` (продление до 2027 + retune правил 2.2.2.2/2.2.2.3).
Ticket-01 = component-тикет: закодировать discriminating scenarios S1–S6 в существующих integration-test классах + перегенерировать `expected_result*.csv` под CHANGED behavior, доказать RED на текущем коде.

**Симптом (из `.agent/decisions.log`):**

| строка | role/stage | status |
|---|---|---|
| `decisions.log:31` | `wirth-tester` `rework-ticket-01-r1` | запущен (steps:25) |
| `decisions.log:32` | `wirth-tester` `rework-ticket-01-r1` | **DROPOUT-step-cap-research-only-no-artifacts** (transient, not FAIL) |
| `decisions.log:33` | `izi` `rework-ticket-01-retry` | dispatching fresh `@wirth-tester r2/2` **with research-prefilled** |

**Итог:** 25 шагов `wirth-tester` ушли на research-фазу (чтение harness-кода), ни одного артефакта не создано. Retry пришлось делать с контекстом, впихнутым вручную (`research-prefilled`).

---

## 2. Корневые причины (3 сходящихся гэпа)

### A. Shape-mismatch: `target=library`, но харнес заточен под service/CLI

| Факт | Доказательство |
|---|---|
| `.agent/planner/target` = `library`, `.agent/planner/mode` = `route=rework-behavior` | `cat .agent/planner/target mode` |
| `harness/target-profiles.json` содержит только `service` и `cli` | `read ~/.rationaldev/harness/target-profiles.json` — 2 профиля |
| Скилл `component-tests/SKILL.md` весь про Docker Compose + godog + `.feature` | `read .opencode/skills/component-tests/SKILL.md` — "component tests always run in Docker Compose" |
| Реально тесты = JUnit `@SpringBootTest` + CSV-фикстуры + `CheckDataUtil` | `src/test/java/.../thriceinplus/unit/ThriceInPlusTest.java` |
| `validate-dod.mjs` требует go.mod/Dockerfile/Gherkin/openapi.yaml | `.agent/plan-reviewer/plan-review.md:20` — "harness/shape mismatch" |

**Следствие:** `@wirth-tester` приходит с фреймингом "`.feature` + step-defs + compose + `validate-component-tests.mjs`", неприменимым к Java/Spark library. Тратит шаги на адаптацию фрейма к реальности.

### B. Step-бюджет: `wirth-tester steps:25` мало для rework на существующем коде

`wirth-tester.md:6` → `steps: 25`.

Rework на существующем коде = 3 фазы:
1. **Research** — harness-классы (`CheckDataUtil`, `ThriceInPlusTestTools`), CSV-формат, POJO-схема, sibling-тесты, `run` vs `runDetails`. Минимум 15-20 шагов.
2. **Edit** — test-классы (S1–S6 в 4 файлах) + `expected_result*.csv` (4 файла) + возможно POJO/CSV-расширение для S2. Минимум 12-15 шагов.
3. **RED-verify** — `./gradlew test --tests "*ThriceInPlus*"` + `checkstyleTest` + фикс style. Минимум 5-8 шагов.

**Итого нужно:** ~32-43 шагов. **Есть:** 25. → DROPOUT на research, до edit не доходит.

### C. Ticket-context gap: нет sibling-указателя, тестер изучает весь test-tree

`ticket-01.md` описывает **что** тестировать (S1–S6, RED-reasons, payout vs marker различимость), но НЕ даёт **где/как**:
- В какие test-классы класть сценарии (4 класса: `ThriceInPlusTest`, `Month2Test`, `Month3Test`, `Month5Test`).
- Какой assert-method для payout vs marker (`checkCards` vs `checkSpecialBadGirls`).
- Где пример marker-assert (в `thriceinplus` его НЕТ — только в `zkh/in/dbo/util/ZkhInDboPeriod3Test.java:271`).
- CSV-формат (`;`-разделитель, 18-значный BigDecimal, null=пусто, исключённые = нет payout-строки).
- Known gap: `PaidAmount.java` БЕЗ `cashback` (блокер для S2/OQ-4).

**Следствие:** тестер `glob`'ит весь `src/test/**`, читает 6-8 классов чтобы найти конвенцию. 25 шагов исчезают.

---

## 3. Предлагаемые улучшения

### 3.1 Увеличить step-бюджет `wirth-tester`: 25 → 40

**Файл:** `~/.rationaldev/harness/agents/_shared/wirth-tester.md` (frontmatter `steps: 25` → `40`).
**Перегенерация:** `node harness/gen-agents.mjs` → проекция `agents/opencode/wirth-tester.md` обновится.

**Обоснование:** rework на существующем коде требует research+edit+verify (≈32-43 шага). 25 — только greenfield-сервисы с готовым scaffold+contract. 40 покрывает rework без DROPOUT.

**Альтернатива (дороже, не предлагается):** пер-shape/mode steps (library/rework=40, service-greenfield=25) — требует правки `frontmatter.mjs`/`gen-agents.mjs`.

**Минус:** `steps:40` для всех вызовов `wirth-tester` — дороже на простых service-тикетах. Принимается ради простоты (нет правки генератора).

### 3.2 Sibling-указатель + S→mapping table в component-тикете

**Файл:** `~/.rationaldev/harness/agents/_shared/wirth-ticketer.md` — добавить требование: component-тикет MUST содержать секцию `### Test-harness cheat-sheet`.

**Содержимое секции (тикеттер заполняет из репо-локального harness-reference, п.3.3):**

1. **Neighbor reference** — 1-2 тест-класса в ТОМ ЖЕ пакете, демонстрирующих конвенцию. Тестер читает ТОЛЬКО их, не весь test-tree.
   - Для ThriceInPlus: `ThriceInPlusMonth3Test.java` (m2, ближайший к S1) + `zkh/in/dbo/util/ZkhInDboPeriod3Test.java:271` (единственный пример `checkSpecialBadGirls` — marker-assert, в thriceinplus его пока НЕТ).

2. **S→mapping table**:

   | S | test-class | @Test method | expected-CSV | assert-method |
   |---|---|---|---|---|
   | S1 | `ThriceInPlusMonth3Test` | `s1_calcGroupMarker_or` | `expected_result_m3.csv` (+row) | `checkCards` (0→1500) |
   | S2 | `ThriceInPlusMonth2Test` | `s2_prev_cashback_gt_zero` | `expected_result_m2.csv` (+row) | `checkCards` (1500→0) |
   | S3 | `ThriceInPlusTest` | `s3_null_first_sal` | — | `checkSpecialBadGirls`(NOK_NULL_FIELD) via `runDetails` |
   | S4 | `ThriceInPlusMonth5Test` | `s4_month_delta_range` | — | `checkSpecialBadGirls`(NOK_MONTH_DELTA_OUT_OF_RANGE) |
   | S5 | `ThriceInPlusTest` | `s5_avg_balance_entry` | — | `checkSpecialBadGirls`(NOK_LOW_AVG_BALANCE_ENTRY) |
   | S6 | `ThriceInPlusMonth2Test` | `s6_canonical_month_delta` | `expected_result_m2.csv` (+row) | `checkCards` (1500→0) |

3. **Fixture cheat-sheet** — CSV header, `;`-разделитель, null=пусто, `bonus_sum` ∈ {0,1000,1500,2500}, исключённые = нет payout-строки.

4. **Known gaps** — `PaidAmount.java` БЕЗ `cashback` (OQ-4/S2 → нужно расширить POJO + CSV + loader).

**Эффект:** тестер не `glob`'ит test-tree, а работает по таблице. Research-фаза: 5 шагов вместо 25.

### 3.3 Репо-локальный harness-reference (docs-артефакт, не скилл)

**Файл:** `opl-spark-promoactions/docs/design/_harness/library-test-harness.md` (новый).

**Почему не скилл:** `.opencode/skills` — симлинк на `~/.rationaldev/skills/lib` (ядро харнеса). Файл туда физически пишется в ядро, становится глобальным для всех проектов, и ломает авто-апдейт при следующем `install.sh`. Заменить симлинк на директорию — сломает обновление. Поэтому reference = docs-артефакт в репо.

**Содержимое:**
- **Harness map** — `CheckDataUtil.java:55` (`checkCards`=payout), `:86` (`checkGoodBoys`), `:101` (`checkBadGirls`), `:116` (`checkSpecialBadGirls`=markers via `runDetails`), `:131` (`checkAvgBalanceCards`); `ThriceInPlusTestTools.java:48/75/92/111` (loaders); `SparkSessionInitBase.assertEqualsValuesInColumn`.
- **Pattern references** — где есть пример каждого assert-типа. Marker-assert живёт в `zkh/in/dbo/util/ZkhInDboPeriod3Test.java:271` (в thriceinplus пока НЕТ).
- **CSV format** — `;`-разделитель, header `client_id;card_id;transaction_amount;bonus_sum`; 18-значный BigDecimal; null=пустое поле; `bonus_sum` ∈ {0,1000,1500,2500}; **исключённые клиенты = нет payout-строки** (не `bonus_sum=0`).
- **POJO-схема** — `PaidAmount.java` `{client_id, card_id, paid_amount, paid_count}` БЕЗ `cashback` → known gap для OQ-4 (S2).
- **run vs runDetails** — `run` = payout Dataset (assert `bonus_sum`); `runDetails` = `Try<Dataset<Row>>` с markers (assert marker name). S3/S4/S5 — второй.
- **Команды** — `./gradlew test --tests "*ThriceInPlus*"`; `checkstyleTest` pre-commit.
- **Sibling-test индекс** — по пакетам: какой тест-класс демонстрирует какую конвенцию.

**Связь с ядром:** профиль `library` (п.3.4) содержит `test_harness_ref: "docs/design/_harness/library-test-harness.md"` (optional). Тикеттер читает reference при заполнении cheat-sheet секции тикета.

### 3.4 Профиль `library` в ядре (open-closed расширение)

**Файл 1:** `~/.rationaldev/harness/target-profiles.json` — добавить профиль:
```json
"library": {
  "contract": [],
  "ingress_skill": null,
  "template": null,
  "readme_sections": ["failure-map", "build-run"],
  "ctest": "junit-csv",
  "test_harness_ref": "docs/design/_harness/library-test-harness.md",
  "toolchain": [
    {"label":"java","file":"(^|/)build\\.gradle$","extract":"sourceCompatibility\\s*=\\s*'?(\\d+)","flags":""}
  ]
}
```

`test_harness_ref` — optional относительный путь от корня репо. Нет файла → тестер без cheat-sheet (как сейчас). Есть → экономия шагов.

**Файл 2:** `~/.rationaldev/skills/lib/target-profiles/SKILL.md` — +колонка `library` в таблицу (строки 17-24) + абзац про `test_harness_ref` в §"Adding a shape".

**Принцип:** open-closed (Meyer/SOLID). Добавление формы = + один профиль, 0 правок стадий. Профиль optional — безопасен для существующих service/cli проектов.

### 3.5 `wirth-tester`: делегирование в профиль для non-service

**Файл:** `~/.rationaldev/harness/agents/_shared/wirth-tester.md` — перед "What you are" добавить блок:

> If `.agent/planner/target` ≠ service/cli: read `test_harness_ref` from `harness/target-profiles.json` (relative to repo root). If file exists → follow the cheat-sheet for test-class placement, assert-methods, fixture formats. Skip `.feature`/compose/`validate-component-tests.mjs` (service/CLI-only). Coverage formula unchanged.

**Permission:** в frontmatter `edit:` — для `library` добавить `src/test/**` allow (сейчас `component-tests/**` only). Варианты:
- (A) В ядре frontmatter: условный allow `src/test/**` — затронет все проекты.
- (B) В профиль: вынести edit-paths в `target-profiles.json` как массив — дороже (правка `frontmatter.mjs`/`gen-agents.mjs`), но полностью Strategy-clean.

Предлагается (A) с ограничением: `src/test/**` allow только при `target=library` (условие в теле роли, не в frontmatter — frontmatter не умеет per-shape).

**Перегенерация:** `node harness/gen-agents.mjs`.

---

## 4. Ожидаемый эффект

| Фаза | До | После |
|---|---|---|
| Step-бюджет | 25 | 40 |
| Research | 25 шагов (DROPOUT) | ~5 (1-2 соседа + cheat-sheet) |
| Edit | 0 (не дошёл) | ~20 |
| RED-verify | 0 | ~10 |
| Retry | ручной `research-prefilled` | не нужен |
| Токены на research | ~100% (весь бюджет) | ~30% |

**Экономия:** ~60-70% токенов на research-фазе per rework-тикет. Без DROPOUT, без ручного prefill.

---

## 5. Риски

| # | Риск | Митигация |
|---|---|---|
| 1 | Правки ядра (`_shared/wirth-tester.md`, `target-profiles.json`) затрагивают ВСЕ проекты | Профиль `library` optional; `steps:40` дороже на простых service-тикетах, но безопасно |
| 2 | `validate-dod.mjs`/`validate-contract-frozen.mjs` могут не ждать `contract:[]` (пустой контракт) | Проверить валидаторы до реализации; `plan-review.md:20` уже фиксирует "harness/shape mismatch" |
| 3 | `steps:40` для всех `wirth-tester` вызовов | Принимается ради простоты; альтернатива (per-shape steps) дороже |
| 4 | `wirth-ticketer.md` не прочитан — шаблон тикета может быть в другом месте | Прочитать `_shared/wirth-ticketer.md` до правки |
| 5 | Репо-reference `library-test-harness.md` не авто-загружается (не скилл) | Тикеттер читает по указателю из тикета; тестер — по sibling-указателю. 1 `read` вместо 6-8 |

---

## 6. Порядок реализации

1. **Ядро (3 файла):**
   - `~/.rationaldev/harness/target-profiles.json` — +профиль `library`.
   - `~/.rationaldev/skills/lib/target-profiles/SKILL.md` — +колонка `library`.
   - `~/.rationaldev/harness/agents/_shared/wirth-tester.md` — `steps:25→40` + блок делегирования + permission.
   - `node harness/gen-agents.mjs` — перегенерация проекций.

2. **Репо (2 файла):**
   - `docs/design/_harness/library-test-harness.md` — cheat-sheet (CheckDataUtil map, CSV-формат, POJO-схема, sibling-индекс).
   - `docs/design/thriceinplus/changes/001-extend-to-2027-retune-rules/tickets/ticket-01.md` — секция `### Test-harness cheat-sheet` с S→mapping table.

3. **Валидация:**
   - Повторный прогон ticket-01 через `@wirth-tester` → ожидается: нет DROPOUT, research ~5 шагов, артефакты созданы.
   - `grep -r "if shape" .opencode/` — пусто (Strategy соблюдён).

---

## 7. Open questions (для оператора)

- Подтвердить `steps:40` для всех `wirth-tester` вызовов (или per-shape?).
- Permission edit-paths: вариант (A) в ядре frontmatter или (B) в профиль?
- Проверять валидаторы ядра на `contract:[]` до реализации или по факту?
