# route-foreign-lane — четвёртый вес конвейера для ЧУЖИХ репо 🔴

> **Ось — происхождение (provenance), не форма (shape).** Строгие лейны (greenfield/rework/chore)
> презюмируют, что репо построено этим харнесом (есть design-пакет, парадигма Gherkin/Docker/openapi).
> `route=foreign` владеет случаем **репо, построенного вне харнеса** — Java/Spark library, Spring-сервис,
> Python-CLI, любой стек и раннер. Чужой сервис/CLI/библиотека — все сюда.
>
> **Кредо: conform, не impose.** Не навязываем контракт и `.feature`; **разведываем** конвенции репо
> (раз на репо), правим по ним, корректность держим **discriminating-инвариантом** (old ≠ new на данных),
> а не наличием инфра-артефактов.

## Мотивация — кейс и критика `harnes-imp.md`

Пост-мортем [`harnes-imp.md`](./harnes-imp.md): rework Java/Spark library (`ThriceInPlus`), `@wirth-tester`
сжёг 25 шагов на research чужой парадигмы (JUnit+CSV вместо godog/`.feature`), словил DROPOUT, retry с ручным
`research-prefilled`. Его лекарства — точечные заплатки, которые **не открывают гейт и текут в ядро**:

1. **Лечит симптом, не болезнь.** `steps 25→40` — сплошная правка ядра (дорожает каждый service-тикет),
   обрыв просто сдвигается. Настоящий фикс — research **однократно, дешёвым скаутом, закэшировать**.
2. **Профиль `library` необходим, но не открывает DoD.** Реальный блокер — `FIXED_ARTIFACTS` в
   `validate-dod.mjs:53–59` (Dockerfile/compose/`.feature` для ВСЕХ форм, мимо профиля) + жёсткие
   `go.mod`/`go build`/`go test` + `validate-component-tests.mjs` (только Gherkin). Поле `ctest: junit-csv`,
   на которое опирается фикс, — **мёртвый код** (не читает никто).
3. **Размазывает чужую парадигму по строгому ядру** (`src/test/**` в общей роли тестера, сплошной бамп) —
   ровно то, чего скилл `target-profiles` запрещает («if shape smeared across layers»).
4. **Игнорирует уже проведённую границу** — `change-intake.md:96` явно STOP'ает чужой репо («out of scope»).

**Вывод:** не патчить строгий rework, а **добавить лейн**, владеющий чужим репо, при нетронутых строгих лейнах.

## Прецедент — chore-lane (#59)

Механизм релаксации chore = шаблон: `mode`-токен в triage (axis-0 short-circuit) + секция-лейн в izi +
durable-план в своей папке (`docs/chores/`) + пара `isChoreMode()`/`hasChorePlan()` в `shared.mjs`, вшитая в
`planReadyForApproval` и ветку implementer-гейта (зеркалится в `.mjs`, читается `gate-check.mjs`). **Ноль
стадийного ветвления — вся релаксация в guardrail.** DoD chore = verification-команда, `validate-dod` обойдён.
`route=foreign` строится по этому же образцу.

## Логическая цепочка (функциональный стиль)

```haskell
-- Артефакты
HarnessLib   -- docs/design/_harness/*  ── ПАРАДИГМА РЕПО (build-cmd, test-runner, fixture-format, assert-каталог, sibling-индекс, known-gaps)
ChangeDelta  -- discriminating-сценарии: input · out_old ≠ out_new · RED-reason

-- Стадии (роль · In → Out)
gilb     :: BR                        -> Result BRD          -- фронтдор, грил
triage   :: BRD                       -> Result Route        -- НЕТ harness-пакета ⇒ Foreign; пишет mode=foreign
survey   :: Repo                      -> HarnessLib          -- @surveyor  ── ×1 НА РЕПО (мемоизирован)
intake   :: (BRD, Repo, HarnessLib)   -> Result ChangeDelta  -- @change-intake: дельта против РЕАЛЬНОГО кода + карты
ticket   :: (ChangeDelta, HarnessLib) -> Tickets            -- @wirth-ticketer: cheat-sheet из HarnessLib
plan     :: Tickets                   -> Plan               -- @wirth-planner: + verification-cmd
review   :: Plan                      -> Result Plan        -- @mills (лёгкий): discriminating не degenerate + plan↔lib
gate1    :: Plan                      -> IO Approved         -- ЧЕЛОВЕК #1
branch   :: Approved                  -> Branch             -- @git-hand mode=start → foreign/<slug>
redFirst :: (Tickets, HarnessLib)     -> RedTests           -- @wirth-tester + skill conform-tests: РОДНОЙ раннер, доказан RED
implement:: (Tickets, RedTests)       -> GreenImpl          -- @hughes-rework
dod      :: GreenImpl                 -> Result Verified    -- verification-cmd GREEN (НЕ validate-dod)
terminal :: Verified                  -> PR                 -- @git-hand mode=terminal
gate2    :: PR                        -> IO Merged          -- ЧЕЛОВЕК #2
canary   :: Merged                    -> Canary             -- @michtom
gate3    :: Canary                    -> IO Accepted        -- ЧЕЛОВЕК #3

-- Композиция (Kleisli, Result+IO)
foreignChange =
      gilb >=> triage
           >=> withSurvey                       -- врезка до intake
           >=> intake >=> ticket >>> plan
           >=> review >=> gate1                  -- Human Gate #1
           >=> branch >=> redFirst >=> implement
           >=> dod                               -- verification-cmd
           >=> terminal >=> gate2                -- Human Gate #2
           >=> canary  >=> gate3                 -- Human Gate #3

-- Инварианты (несут корректность вместо строгой скорлупы)
survey repo | fresh (harnessLibOf repo) = harnessLibOf repo    -- идемпотентно, ключ = Repo (не Change) ⇒ одна библиотека на все ченджи
            | otherwise                 = writeLib (scan repo)  -- ×1 на репо / при дрейфе тест-три
discriminating s = eval old (input s) /= eval new (input s)    -- degenerate ⇒ STOP: test-input rework (парадигмо-независимо)
canImplement     = brd ∧ planArtifact ∧ approved gate1 ∧ onWorkBranch  -- + isForeignMode/hasForeignPlan (стек-агностичен)
```

## Где foreign расходится со строгим (ровно 3 точки)

| Точка | strict | foreign |
|---|---|---|
| после triage | сразу intake против harness-пакета | **врезан `survey`** → HarnessLib; `change-intake:96`-STOP снят под mode=foreign |
| источник теста | контракт (openapi) → `.feature`/godog | **HarnessLib** → родной раннер, skill `conform-tests` |
| DoD | `validate-dod` (go build + `.feature`) | **verification-cmd green** (chore-стиль) |

Всё прочее — фронтдор `@gilb`, 3 человеческих гейта, on-trunk-блок, git-hand, closed role set — **идентично**.

## Решения (зафиксированы с оператором)

- **Имя:** `route=foreign` / `mode=foreign`.
- **Ось:** provenance (наш/чужой репо), ортогонально shape. **Глобальный профиль `library` НЕ заводим** —
  парадигма чужого репо живёт per-repo в `docs/design/_harness/`, не в `target-profiles.json`.
- **Триггер:** авто-детект в triage (нет harness design-пакета ⇒ foreign); оператор может переопределить.
- **Скаут:** новая роль `@surveyor` (дешёвая, ×1 на репо, кэш) — не раздувать `change-intake`.
- **Библиотека:** один `docs/design/_harness/test-harness.md` (сплит при >300 строк), рефреш идемпотентный.
- **Путь по соглашению** (`docs/design/_harness/`, как `docs/chores/`), без поля `test_harness_ref` в профиле.
- **`@mills`** держим лёгким ревью (discriminating не degenerate + plan↔lib), не выкидываем.

### Путь-конвенции (зафиксированы в T2, параллель chore)

- **`docs/design/_harness/test-harness.md`** — репо-уровневая библиотека парадигмы (пишет `@surveyor`, ×1 на репо).
- **`docs/foreign/<NNN-slug>/FOREIGN-PLAN.md`** — durable per-change план (артефакт Gate #1; пишет `@wirth-planner`).
  Гейт под `mode=foreign` требует его вместо `plan-review.md` (как chore требует `CHORE-PLAN.md`).

## Тикеты

| # | Тикет | Суть | Файлы (ядро) |
|---|-------|------|--------------|
| **T1** | triage: provenance-детект + `route=foreign`/`mode=foreign` | axis «нет harness design-пакета ⇒ foreign»; return-контракт + запись `mode` | `_shared/wirth-triage.md` |
| **T2** | enforcement: `isForeignMode()`/`hasForeignPlan()` | пара в `shared.mjs`, вшита в `planReadyForApproval` + ветку implementer-гейта; зеркало в `.mjs`; `gate-check.mjs`; smoke | `enforcement/shared.mjs`, `opencode/rational-guardrail.mjs`, `claude/gate-check.mjs`, `test/*` |
| **T3** | роль `@surveyor` + соглашение `docs/design/_harness/` | разведка репо → `test-harness.md` (build/test-раннер/fixture/assert-каталог/sibling/known-gaps); идемпотентно, ×1 на репо | new `_shared/surveyor.md`, `gen-agents` |
| **T4** | `change-intake` foreign-вариант | снять `:96`-STOP под mode=foreign; дельта против РЕАЛЬНОГО кода + HarnessLib; discriminating-инвариант сохранён | `_shared/change-intake.md` |
| **T5** | skill `conform-tests` + `@wirth-tester` foreign-вариант | парадигмо-агностичная дисциплина (формула `1+Σ` + RED-reason, раннер из HarnessLib); правит РОДНОЙ тест-каталог; строгий `component-tests` НЕ трогаем | new `skills/lib/conform-tests/`, `_shared/wirth-tester.md` |
| **T6** | `@wirth-ticketer`: секция `### Repo cheat-sheet` | из HarnessLib (не re-derive per-slice); только foreign | `_shared/wirth-ticketer.md` |
| **T7** | DoD = verification-команда (foreign acceptance) | приёмка прогоном родной test/build-команды репо (chore-стиль), `validate-dod` Go/Gherkin обойдён | `_shared/izi.md` (acceptance), возможно `_shared/fagan.md` |
| **T8** | izi: секция-лейн `route=foreign` + wiring + `@mills` лёгкий ревью + docs/smoke | последовательность стрелок, impl-routing, лёгкое ревью; `target-profiles/SKILL.md` заметка provenance-vs-shape; `docs/00_PROCESS`/`01_DIAGRAM` | `_shared/izi.md`, `_shared/mills.md`, `skills/lib/target-profiles/SKILL.md`, `docs/*`, smoke |

**Порядок:** T1→T2 (лейн доходит до гейта) → T3 (библиотека) → T4 (intake) → T5/T6 (тест+тикет по библиотеке) →
T7 (DoD) → T8 (оркестрация+ревью+docs). Каждый тикет — своя ветка/PR, smoke зелёный.

## Риски

| # | Риск | Митигация |
|---|------|-----------|
| 1 | Авто-детект foreign ложно срабатывает на harness-native репо без пакета (ранняя стадия) | Детект = «нет `docs/design/**` И признаки чужого стека»; оператор переопределяет; по умолчанию — строгий лейн |
| 2 | `@surveyor` неверно снимает конвенции (кривой cheat-sheet) → тестер по ложной карте | Библиотека — durable-артефакт в PR, ревьюится на Gate #1; discriminating-инвариант ловит degenerate-тест независимо |
| 3 | verification-cmd DoD слабее Go-DoD (нет статик-гейтов) | Для чужого репо это и есть его контракт; команда фиксируется в плане + ревью; строгий DoD остаётся у своей вселенной |
| 4 | Дрейф: `conform-tests` дублирует логику `component-tests` | Общее ядро (формула+RED-reason) вынести/со-сылать; парадигмо-специфика — только в `conform-tests` |
| 5 | Правки общих ролей (`wirth-tester`/`ticketer`/`change-intake`) задевают строгие лейны | Все ветки — `if mode=foreign` в теле роли (не в frontmatter), строгий путь по умолчанию нетронут; smoke на оба |
