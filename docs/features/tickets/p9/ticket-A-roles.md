# Тикет A — роли и флоу

**Владеет:** `harness/agents/_shared/*.md`, `docs/flows/*.md`, единственный прогон `node harness/gen-agents.mjs`.
**Не трогает:** `harness/enforcement/**`, `harness/validate-*.mjs`, `harness/lib/**`, `harness/close-run.mjs`,
`harness/test/**` (если правка требует теста — STOP, доложить).

## A1 · Удалить `level=trivial` (P9-4)

Досемверная ветвь, единственная в обход Gate #1. Правка существующего кода в 1 модуль без смены контракта =
`patch` (`design=skip`); новый код в 1 модуль = вырожденный greenfield-`modular`.

- `wirth-triage.md` — убрать уровень `trivial` из Axis 2 и из возвратной строки/белого списка маркера; остаются
  `modular`, `epic`. `wirth-intake.md`, `hughes.md` — убрать упоминания `trivial`.
- `izi.md` — убрать строку `route=greenfield · level=trivial` из таблицы роутинга и обход «прямо к `@hughes`».
- `docs/flows/greenfield-flow.md` — убрать `trivial` из инварианта веса; описать, что такие задачи уходят в
  `patch`/`modular`.
- Грепом убедиться, что `trivial` не остался осиротевшим (кроме исторических доков вне flows).

## A2 · `@wirth-moduledesigner` учит `change-dir` (P9-5)

`wirth-moduledesigner.md:57-65` — сентинел идемпотентности смотрит на greenfield-путь
`docs/design/<slice>/module-tree.md` (уже `DONE:`), из-за чего на `minor`/`major` дизайн молча схлопывается.
Завести SemVer-режим (как у `wirth-apidesigner`/`wirth-planner`): читать `.agent/planner/change-dir`, выход **и
сентинел** — на `<change-dir>/module-tree.md`. Проверить, не завязан ли сентинел тем же путём на
`contracts.md`/`c4.md` — тогда чинить все три выхода.

## A3 · Тексты под новый contract-diff (общий контракт §1)

- В `docs/flows/minor-flow.md` и `major-flow.md` убрать формулировку флага `--require-additive` — теперь это
  поведение по умолчанию (одно поведение, флага нет). Описать дифф как **диспетчер по формату** (OpenAPI →
  `oasdiff breaking`, AsyncAPI → `asyncapi diff`, JSON Schema → встроенный), fail-closed при отсутствии
  инструмента. `minor`: breaking → STOP → ре-триаж `major`. `major`: список breaking → в тело PR + миграционный
  тикет.
- `wirth-apidesigner.md` — вписать, что после заморозки контракта запускается диспетчер diff (тот же CLI), и что
  разница по весам живёт в конвейере, а не во флаге.
- `mills.md`, `fagan.md` — если ссылаются на `--require-additive`, заменить на «diff вернул 0 breaking»
  (поведение по умолчанию), не на флаг.

## DoD

- `grep -rin "trivial" harness/agents/_shared docs/flows` — пусто (исторические доки вне flows допустимы, назвать).
- `grep -rin "require-additive" harness/agents/_shared docs/flows` — пусто.
- `node harness/gen-agents.mjs` успешен; `node harness/gen-skill-index.mjs --check` — OK.
- `node --test harness/test/*.mjs` зелёный (254). Если тест ссылается на `trivial`/`--require-additive` — **STOP,
  доложить** (тест-файл может быть чужого пакета).
- Роли ≤300 строк.
