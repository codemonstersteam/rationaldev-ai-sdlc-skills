# Тикет C — enforcement

**Владеет:** `harness/enforcement/**` (shared.mjs + claude/* + opencode/*), тесты
`harness/test/{plan-ready.test.mjs,guardrail-sync.test.mjs,claude-hooks.smoke.mjs}`,
`harness/enforcement/opencode/guardrail.smoke.ts`.
**Не трогает:** роли `_shared/*`, валидаторы, close-run. Паритет claude/opencode обязателен
(`guardrail-sync.test.mjs` сверяет INLINED-символы — не разъезжаться).

## C1 · `planReadyForApproval` привязать к текущей работе (P9-3)

`shared.mjs:74` считает план собранным, если хоть где-то в `docs/design/*/` есть `PLAN.md`. Но `PLAN.md` вечен →
после первого greenfield проверка всегда истинна, защита от преждевременного `GATE1 APPROVE` мертва. Спрашивать
про план **текущей** задачи по адресу из состояния: `.agent/planner/change-dir` (SemVer/онбординг) ·
`chore-dir` (chore) · текущий срез из `slices.md` (greenfield) — не «любой durable `PLAN.md`». Синхронно поправить
инлайн-копию в `opencode/rational-guardrail.mjs`. Тест `plan-ready.test.mjs`: план другой (закрытой) задачи не
удовлетворяет проверку текущей.

## C2 · Другие проверки той же болезни (P9-3, заодно)

Пройти `shared.mjs` на проверки «существует хоть один durable-артефакт» (тикеты/контракт глобом) вместо привязки
к текущей работе. Найденное — привязать так же. Если ничего нет — зафиксировать это в отчёте.

## C3 · chore: поканйока «зелёный без артефакта» (P9-7)

`gate-bash.mjs:19` (`missingOutputs`) ищет тикет `docs/design/*/tickets/ticket-<id>.md`, чтобы не дать `green`
без непустого выхода. У chore тикетов нет → проверка всегда пустая, отключена структурно. Включить для chore
эквивалент: проверять выход шага chore (наличие/непустота файла из `CHORE-PLAN.md` / изменённого файла), чтобы
`green` без реального артефакта не проходил. Синхронно в opencode-зеркале. Тест в `claude-hooks.smoke.mjs`.

## C4 · Осиротевший `trivial` в enforcement (координация с A)

Пакет A убирает `level=trivial` из ролей. Если гардрейл/хуки ссылаются на `trivial` (маловероятно — grep
показал только роли), убрать здесь. Если ссылок нет — отметить в отчёте, ничего не делать.

## DoD

- `node --test harness/test/{plan-ready,guardrail-sync}.test.mjs` + `node harness/test/claude-hooks.smoke.mjs`
  зелёные, новые кейсы на C1/C3.
- `node --test harness/test/*.mjs` зелёный (254 + новые).
- claude и opencode ветки enforcement синхронны (`guardrail-sync` проходит).
