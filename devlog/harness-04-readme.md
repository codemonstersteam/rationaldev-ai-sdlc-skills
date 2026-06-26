# devlog/harness-04-readme.md

## Задача

Slice 4 харнеса: инструкция «как начать» — быстрый старт + матрица установки
(global/project × 3 раннера).

## Принятое решение

- `docs/story-harness/README.md`: быстрый старт (clone → install → запуск), матрица
  `./install.sh <runner> [--global|<dir>]`, что куда ставится, точка входа
  (`orchestrator`), human-gates, memory/decisions.log, `--hard` (Slice 6),
  перегенерация (`gen-agents.mjs`).
- Указатель из корневого `README.md` на гайд (обнаружимость), добавлен недеструктивно
  одним блоком после ссылки на CONCEPT.

## Результат

- Гайд готов; пользовательский контракт: `git clone` → `./install.sh <runner> [scope]` → запуск.
- Дальше: Slice 5 — Gherkin-смоук харнеса (`@auto` установка + `@manual` маршрутизация).
