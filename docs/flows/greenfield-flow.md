# greenfield-flow — вертикаль GREENFIELD (v0 → 1.0.0)

> **Вес `greenfield`** — сервиса/CLI **ещё нет**. Строится первая вертикаль: FRD → срезы → **замороженный
> контракт** → дерево модулей → README → тикеты → код. Транк получает **`1.0.0`** (первый публичный релиз —
> SemVer 2.0.0 §5: «Version 1.0.0 defines the public API»). Это **хребет** конвейера; вертикали
> `patch`/`minor`/`major` наследуют его вторую половину (Gate #1 → имплементация → DoD → терминал → Gate #2 →
> закрытие прогона) и отличаются только головой.

## Инвариант веса

- **Greenfield = публичного API ещё нет.** Совместимость не с чем ломать → решающая ось SemVer здесь не
  применяется; вопрос не «что сломается», а **что вообще есть контракт**.
- Итог прогона — **`1.0.0`**: контракт заморожен (`x-frozen`), значит с этого момента он и есть та самая
  «documented public API», обратную совместимость которой судят все последующие веса.
- **Форма проекта (`service` | `cli`) — вертикаль шаблона**, не ветка в ролях: профиль в
  `harness/target-profiles.json` задаёт контракт (`openapi.yaml` либо `config.schema.json` + `report.schema.json`),
  ingress-скилл, шаблон (`template-go-api` / `template-go-cli`) и разделы README. Стадии делегируют профилю.
- `level=trivial` (новый код, контракт не меняется) — планирование **пропускается**, izi отдаёт задачу прямо
  `@hughes`. `level=epic` (>2 модулей или >1 сервиса) — **STOP**: алгоритм эпика не реализован.
- **Прогон закрывается явно.** `.agent/` истинно только пока прогон открыт: после мерджа `@ledger` стирает
  состояние, оставляя запись в `docs/changes/LEDGER.md` — иначе `gate1.approved` прошлой задачи пропустит
  следующую через гейт.

**Никакой разведки.** Репозиторий строит сам харнес: стандарт не подбирается под репо, а задаётся им.
Ролей `@surveyor`/`@foreign-designer`/conform-режима **нет**; набор ролей закрыт (izi.md §Core rules).

## Пошаговый флоу

Легенда: **In** — вход · **Out** — выход · **✓** — чем проверяется · **⟳** — раунды · **тир** — тир и почему.

| # | Шаг (роль · izi-имя) | In | Out | ✓ Проверка | ⟳ Раунды | тир · почему |
|---|---|---|---|---|---|---|
| 0 | **Фронт-дор** `@gilb` (Gilb) | `TASK.md` (сырое БТ) | `.agent/planner/brd.md` — **измеримое** BRD + `target` (service\|cli) | `agent-ready` (fit-критерии есть) | открытые вопросы оператору **по одному**, пока не `agent-ready` | **large** — грилл требования |
| 1 | **Триаж** `@wirth-triage` (Wirth) | brd | `route=greenfield · level=modular` + `.agent/planner/mode` | строка вердикта + маркер mode | 1 | **large** — классификация веса |
| 2 | **Интейк** `@wirth-intake` (Wirth) | brd | `.agent/planner/frd.md` (акторы, UC, data dictionary, карта отказов) | `validate-frd` (у `@mills`); годность/`STOP` решает сам интейк | retry ≤2 на dropout | **large** — требования → FRD |
| 3 | **Нарезка** `@wirth-slicer` (Wirth) | frd | `.agent/planner/slices.md` + **список срезов строкой** | `validate-slices` (атомарность: 1 внешний вход = 1 срез) | retry ≤2 | **large** — декомпозиция |
| 4 | **Use-case ×срез** `@wirth-usecase` (Wirth) | срез + frd | `docs/design/<S>/use-case.md` | сценарии наблюдаемы снаружи | цикл по списку срезов | **large** — сценарное проектирование |
| 5 | **Контракт — ОДИН РАЗ** `@wirth-apidesigner` (Wirth) | **все** use-case | `api-specification/*` (по профилю), **FROZEN `x-frozen`** | `validate-contract-frozen` | **не звать по срезам** — перезапишет контракт | **large** — проектирование контракта |
| 6 | **Дерево модулей ×срез** `@wirth-moduledesigner` (Wirth) | замороженный контракт + use-case | `docs/design/<S>/{module-tree,contracts(io:),c4}.md` (+ `network-topology`/`rollout-plan` при NFR) | секрет модуля назван; `io:` проставлен; C4 рендерится (`validate-mermaid`, advisory) | цикл по срезам | **large** — секреты Parnas / интерфейсы |
| 7 | **README — ОДИН РАЗ** `@dijkstra` (Dijkstra) | замороженный контракт + весь `docs/design/*` | корневой `README.md` (скилл `documentation`) | `validate-readme` (у `@fagan`) | **не тикет** — `scaffold.sh` его сохраняет | **large** — спека → документация → код |
| 8 | **Тикеты** `@wirth-ticketer` (Wirth) | весь дизайн-пакет | `docs/design/slice-<S>/tickets/ticket-N.md`; глобальный порядок: **`ticket-0` scaffold первым (блокирует всё)** → на срез {`component` RED → `module`×N: **один тикет на узел дерева**} → infra | `validate-tickets` (заголовки `type`/`blocked_by`/`inputs` машиночитаемы) | `PARTIAL: wrote a..b` → **дописывает только `@wirth-ticketer`** (не `@hughes`) | **large** — авторство тикетов |
| 9 | **План** `@wirth-planner` (Wirth) | пути пакета | `docs/design/slice-<S>/PLAN.md` — индекс путей + сводка для Gate #1 | `validate-plan` (DAG `blocked_by` без циклов, scaffold первым) | 1 | **large** — сборка индекса, не проектирование |
| 10 | **Ревью — один проход** `@mills` (Mills) | `PLAN.md` + список путей | `.agent/plan-reviewer/plan-review.md` → `OK \| blocker \| escalate` | механика: `validate-frd/slices/contract-frozen/tickets/plan/layout`; семантика: один LLM-проход с цитатами | счётчик раундов **у `@mills`**: раунд ≥1 с блокером → `escalate` | **large** — семантическое ревью |
| 10a | **Локальный фикс** `@linger` (Linger) | вердикт Mills + путь к проблеме | правка **локально** (модуль/артефакт); план не переписывает | перезапуск `@mills` | K=2 → `escalate` | **large** — диагностика дефекта |
| 11 | **Gate #1 — акцепт плана** (человек) | сводка `PLAN.md` **дословно** | `.agent/gates/gate1.approved` — маркер ставит **хук** по токену `GATE1 APPROVE` | izi проверяет `ls .agent/gates/gate1.approved`; **сам никогда не создаёт** | человек | — |
| 12 | **Рабочая ветка** `@git-hand mode=start` (Torvalds) | `task-type=feat`, `slug` | ветка `feat/<slug>` от **свежего** транка; `.agent/vcs/branch` | гардрейл блокирует любого имплементера, пока HEAD на транке | идемпотентно: маркер есть → не резать заново | **small** — механика VCS |
| 13 | **Скаффолд** `@scaffolder` (тикет `type: scaffold`) | `ticket-0` | `harness/scaffold.sh <svc>` — клон шаблона по профилю, переименование, сборка | сборка + компонентные зелёные; `validate-layout` | **сериализован первым**, все прочие `blocked_by` его | **small** — шаблон, не чтение репо |
| 14 | **Компонентные RED** `@wirth-tester` (Wirth) | тикет `type: component` + контракт + use-case | `.feature` + steps + стабы, `@wip` | `validate-component-tests` (формула `N = 1 + Σ ветвей адаптера`) | `green \| FAIL` → `@linger` (K=2) | **small** — укладка **уже спроектированных** сценариев |
| 15 | **Модули** `@hughes` (Hughes) | тикет `type: module` + `inputs` | новый модуль RED→green; скилл по `io:` из заголовка | маркер `ticket-<id> <slice> green` в `.agent/planner/done.log` **самим имплементером** + `node harness/validate-layout.mjs .` чисто | независимые тикеты — параллельно; `FAIL` → `@linger` (K=2) | **medium** — реализация по тикету |
| 16 | **Приёмка DoD** `@fagan` (Fagan) | путь среза + slug | `accepted \| FAIL: <item>`; при `accepted` — **снятие `@wip`** (единственная его запись) | `validate-component-tests` (re-check) + `validate-dod --run` (build/test/файлы/`run-tests`) + `validate-readme` + семантика (README не врёт, нет хардкода) | `FAIL` → `@linger` → снова `@fagan`; приёмщик **не чинит** | **large** — приёмка, разделение обязанностей |
| 17 | **Терминальный git** `@git-hand mode=terminal` (Torvalds) | `task-type`, `slug`, `summary`, `.agent/planner/mode` | commit (git-conventions) → push → PR **`feat: …`** → чтение CI | `ci=green \| red:<reason> \| pending-timeout` — любой исход есть ответ | `ci=red` → `@linger` (K=2) → повтор terminal | **small** — VCS |
| 18 | **Gate #2 — мерж** (человек) | зелёный PR + чек-лист DoD | `.agent/gates/gate2.approved` (ставит **хук** по `GATE2 APPROVE`) + мерж в транк | izi никогда не создаёт маркер и не мержит | человек | — |
| 19 | **Закрытие прогона** `@ledger` (Rochkind) | номер PR | `node harness/close-run.mjs --pr <N>`: пруф мерджа → **тег `1.0.0`** (`ci/semver-bump.mjs`, форма — по последнему релизному тегу) → запись в `docs/changes/LEDGER.md` → **атомарный вайп** `.agent/` | скрипт отказывает без маркера Gate #2 / без пруфа мерджа; запись **до** вайпа | dropout → повтор ≤2 → `escalate` | **small** — механическое закрытие |
| 20 | **Канарейка** `@michtom` (Michtom) | релизный артефакт + `rollout-plan.md` | 1→5→25→100 % за фиче-тогглом + 4 золотых сигнала → `.agent/release-health/release-health.md` | GREEN — расширять, YELLOW — держать, RED — откат (тоггл OFF) | «нет данных ≠ зелено» → эскалация | **medium** — суждение о здоровье |
| 21 | **Gate #3 — приёмка прод-релиза** (человек) | вердикт по 4 сигналам | решение оператора | не прокликивается | человек | — |

## Тиры

**large = суждение** (gilb, triage, intake, slicer, usecase, apidesigner, moduledesigner, dijkstra, ticketer,
planner, mills, linger, fagan). **medium = реализация** (hughes, michtom). **small = механика**
(scaffolder, wirth-tester, git-hand, ledger). Greenfield — самая дорогая вертикаль: почти вся голова
конвейера это проектные решения, которые дальше **переиспользуются** всеми SemVer-вертикалями.

## Раунды

- Dropout стадии (пусто / ошибка / нет артефакта **по точному пути**): **retry ≤2** тем же владельцем → `escalate`.
  `STOP: <reason>` — это **не** dropout: он идёт оператору, харнес останавливается.
- Фикс-петля `@linger`: **K=2** (гардрейл режет третью попытку) → `escalate`.
- Ревью: счётчик держит `@mills` (раунд ≥1 с блокером → `escalate` → решает оператор на Gate #1).
- `PARTIAL:` от `@wirth-ticketer` — остаток дописывает **только он же**.

## Мониторинг процесса

- **Anti-loop:** гардрейл ловит субагента, повторяющего действие без прогресса → dropout → эскалация izi.
- **Watchdog:** плагин на `session.error` (провайдер отвалился) подталкивает izi «продолжай с текущей точки».
- **Идемпотентность/resume:** append-only `.agent/planner/done.log`; перед делегированием тикета izi **грепает**
  его там и **пропускает** уже зелёный. Продвижение только при `green`-маркере **И** чистом `validate-layout`
  (маркер = «произведено», гейт = «положено правильно»).
- **Видимость:** живая строка izi на каждый шаг (роль + izi-имя) + `node harness/progress.mjs .` — фазовая
  полоса читается из реальных артефактов, рисовать её руками запрещено (галлюцинация зелёного тикета).
- **Человеческие гейты не прокликиваются:** #1 план, #2 мерж, #3 прод. Маркер ставит только гардрейл по
  точному токену; самоакцепт izi — нарушение.

## DoD документа

- [x] Инвариант веса зафиксирован (v0 → `1.0.0`, публичного API до этого нет).
- [x] Флоу расписан пошагово: In / Out / ✓ / ⟳ / тир+почему — от `TASK.md` до тега и Gate #3.
- [x] Раунды и мониторинг описаны; закрытие прогона (`@ledger`) — обязательный шаг, не опция.
- [x] Разведки/conform/чужих репозиториев нет: харнес ведёт только то, что построил сам.
