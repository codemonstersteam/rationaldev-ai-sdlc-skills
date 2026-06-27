# Шаблоны тикетов бэклога (reference для program-design, Шаг 11)

Скопируй нужный шаблон в `backlog.md` и замени каждый плейсхолдер `<…>` конкретикой по таблице подстановок из Шага 11.

## Шаблон тикета

```
### TICKET S<n> — slice <name>: <идентификатор входа>

**Спецификация:**
- `.agent/planner/design/<slug>/slices/<n>-<name>.md` (главный документ)
- `.agent/planner/design/<slug>/messages.md` — <перечислить типы, специфичные слайсу>
- `.agent/planner/design/<slug>/contracts-graph.md` — секция «S<n> <name>»
- `.agent/planner/design/<slug>/infrastructure.md` — <что именно: подключение, миграции, Deps>

**Зависимости:** <S<m>, S<k> — что именно импортируется (типы, I/O-объекты)>.
Новых внешних Go-зависимостей нет. (или: новые go.mod записи: <список>)

**Ветка:** `feat/slice-<name>`

**Definition of Done:**

- [ ] `<файл>/domain.go`: <конкретные типы и конструкторы из Шага 3>
- [ ] `<файл>/logic.go`: <конкретные функции из Шага 3> — чистые функции, без I/O
- [ ] `<файл>/adapter.go`: `ParseArgs(args,stderr) -> (Request, error)` — <что парсит>
- [ ] `<файл>/head.go`: `Process<Slice>(req, Deps) -> (Result, error)` — линейная труба
- [ ] `<файл>/register.go`: `Deps{<поля>}` + `NewDeps(<аргументы>) -> Deps`
- [ ] `<точка входа>`: <имя функции> добавлен, `"<name>"` убран из заглушек
- [ ] юнит-тесты по формуле написаны и зелёные — `go test ./...` проходит.
  **<N> новых тестов**: <Модуль1>(<n1>) + <Модуль2>(<n2>) + … (из таблицы Шага 8.1).
  <Голова, адаптер, I/O-объекты> юнитами не покрываются.
- [ ] компонентные тесты зелёные — `<команда запуска>`.
  `@wip` снят с `<name>.feature`; сценарии: «<название1>», «<название2>», … (из Шага 8.3).
  Ранее зелёные сценарии S1–S<m> продолжают проходить.
- [ ] `backlog.md` обновлён по каждому подтверждённому пункту
- [ ] `.agent/planner/design/<slug>/devlog.md` дополнен блоком S<n>
- [ ] PR создан, описание заполнено по шаблону Шага 8 скилла
- [ ] PR смержен в main, CI на main зелёный

**Ссылки на источники:**
- Скилл реализации: `program-implementation`
- Граф вызовов: `.agent/planner/design/<slug>/contracts-graph.md` — секция «S<n>»
- Gherkin-mapping: раздел `## Gherkin-mapping` в `slices/<n>-<name>.md`
- <применённые принципы — «голова без ветвления», «подтип, не guard» и т.п.>
```

## Пример готового тикета

Образец — тикет для слайса `<name>` (CLI-подкоманда, детерминированная
логика без I/O; та же раскладка справедлива для HTTP-эндпоинта):

```
### TICKET S<n> — slice <name>: CLI `<name> <arg>`

**Спецификация:**
- `.agent/planner/design/<slug>/slices/<n>-<name>.md` (главный документ)
- `.agent/planner/design/<slug>/messages.md` — `<Type1>`, `<Type2>`, `<Type3>`
- `.agent/planner/design/<slug>/contracts-graph.md` — секция «S<n> <name>»
- `.agent/planner/design/<slug>/infrastructure.md` — подключение в `internal/cli/cli.go`

**Зависимости:** S<m> (в main) — `<Store>`, `<Sink>`, `New<Target>`,
`NewConfig`, `buildReport`, egress. Новых внешних Go-зависимостей нет.

**Ветка:** `feat/slice-<name>`

**Definition of Done:**

- [ ] `internal/slice/<name>/domain.go`: типы `<Type1>{...}`,
  `<Type2>{...}`, `<Type3>`; конструктор `New<Type3>(input) -> <Type3>`
- [ ] `internal/slice/<name>/logic.go`: `<extractX>`, `<verifyX>`,
  `<buildX>`, `<mergeX>`, `New<Report>`, `<buildOutcome>`
  — чистые функции, без I/O
- [ ] `internal/io/<dep>.go`: интерфейс `<Dep>` + `<NoopDep>{}` (null-object)
- [ ] `internal/slice/<name>/adapter.go`: `ParseArgs(args,stderr) -> (Request, error)`
- [ ] `internal/slice/<name>/head.go`: `Process<Slice>(req, Deps) -> (Report, error)`
- [ ] `internal/slice/<name>/register.go`: `Deps{Store, <Dep>}` + `NewDeps`
- [ ] `internal/cli/cli.go`: `run<Slice>Cmd` добавлен, `"<name>"` убран из `subcommandsTodo`
- [ ] юнит-тесты по формуле написаны и зелёные — `go test ./...` проходит.
  **<N> новых тестов**: `<extractX>`(2) + `New<Type3>`(1) + `<verifyX>`(3)
  + `<buildX>`(3) + `<mergeX>`(3) + `New<Report>`(1)
  + `<buildOutcome>`(2). Голова, адаптер, `<NoopDep>` юнитами не покрываются.
- [ ] компонентные тесты зелёные — `./component-tests/scripts/run-tests.sh healthy`.
  `@wip` снят с `<name>.feature`; сценарии: «<happy → pass>»,
  «<плохой вход → fail>», «<нет ресурса → not_found>».
  Ранее зелёные сценарии S1–S<m> продолжают проходить.
- [ ] `backlog.md` обновлён по каждому подтверждённому пункту
- [ ] `.agent/planner/design/<slug>/devlog.md` дополнен блоком S<n>
- [ ] PR создан, описание заполнено по шаблону Шага 8 скилла
- [ ] PR смержен в main, CI на main зелёный

**Ссылки на источники:**
- Скилл реализации: `program-implementation`
- Граф вызовов: `.agent/planner/design/<slug>/contracts-graph.md` — секция «S<n> <name>»
- Gherkin-mapping: раздел `## Gherkin-mapping` в `slices/<n>-<name>.md`
- Принцип голова без ветвления: `slices/<n>-<name>.md` §«Принцип: голова без ветвления»
```

## Замечание к примеру

Замечание к примеру: голова `Process<Slice>` — **линейная труба без
ветвления**. Опциональный режим (например, дополнительный тир за флагом)
решается **на краю** — роутер выбирает реализацию интерфейса-зависимости
(реальный клиент / null-object), а не ветвит голову; слияние результатов
основной и опциональной логики — отдельный узел-конструктор (`New<Report>`).
Это держит голову читаемой и тестируемой одним компонентным сценарием.
