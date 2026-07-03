# harden-decomposition — жёсткие детекторы против переусложнения ✅

> Найдено на live-прогоне: чистая постановка (`TASK.md`: 1 endpoint, 2 UC, явный out-of-scope) →
> `wirth-intake` раздул FRD до **6 UC** → `wirth-slicer` сделал **5 срезов** (+ изобрёл `service-scaffold`
> срез) → `@mills` **принял** (рационализировал 405/404 как «distinct inputs»). Дыра — **дисциплина
> скиллов, не модель и не постановка**. Проза не держит GLM (mills уже «знал» правило и проглотил) →
> лечим **детерминированными валидаторами + гейтами**, детерминированное вперёд, ранняя протечка первой.

## Корень (по порядку протечки)
`intake` (6 UC вместо 1–2) → `slicer` (5 срезов + псевдо-срезы) → `mills` (проглотил). Постановка чиста.

## Реализовано
**Фаза 0 — INTAKE-детектор (самый ранний):**
- `lib/validators.mjs::validateFrdUseCases` — флаг UC, что суть framework(405/404)/boot(config)/generic-error(500)/bad-request → «сделай Extension'ом».
- Встроен в `harness/validate-frd.mjs` (его уже гоняют `wirth-intake` consequent и `wirth-slicer` antecedent).

**Фаза 3 — детерминированный `validate-slices` (несущий):**
- `lib/validators.mjs::{countOpenapiOperations, validateSlices}` — `#срезов ≤ #operations` контракта + флаг псевдо-срезов по имени (scaffold/method-not-allowed/unknown-route/config/4xx/internal).
- CLI `harness/validate-slices.mjs`. Antecedent-consequent у `wirth-slicer`.

**Фаза 4 — гейт у `mills`:**
- `mills` обязан гонять `validate-slices.mjs`; ненулевой exit = **blocker → @linger переработает**.
- Явная ремарка: «не доверяй прозе-обоснованию слайсера — переусложнение ловится ТОЛЬКО валидатором».

**Фазы 1–2 — правила-проза + анти-примеры:**
- `cockburn-use-case`: «отказ/framework/boot ≠ UC → Extension»; `#UC ≈ #endpoints`; анти-примеры.
- `vertical-slices`: HARD-список НЕ-срезов; `#срезов == #endpoints`; анти-примеры; «проза не переопределяет валидатор».

## Проверено
На реальном раздутом пакете песочницы: `validate-frd` ловит 4 псевдо-UC (exit 1); `validate-slices` ловит
4 псевдо-среза (exit 1); чистый 1-срез/1-UC кейс → exit 0. Юнит-тесты (5 новых) в `validators.test.mjs`
(28/28). Смоук зелёный.

## Приёмка
На той же задаче (`GET /services`): `intake` → ≤2 UC; `slicer` → **1 срез**; валидаторы ловят 6-UC/5-срезовый
пакет как fail; `mills` → blocker. (Полное подтверждение — на новом live-прогоне.)

## Связи
Дополняет **#42** (eval ловит переусложнение пост-хок) — а этот тикет **предотвращает** на дизайне и
**гейтит** на mills. Артефакты: `harness/{validate-frd,validate-slices}.mjs`, `lib/validators.mjs`,
`skills/lib/{cockburn-use-case,vertical-slices}`, роли `wirth-intake`/`wirth-slicer`/`mills`.
