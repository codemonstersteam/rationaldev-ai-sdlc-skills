# Реестр шаблонов

Единая точка: какие шаблоны и образцы использовать на этапах конвейера
([`../04_PLANNING_PIPELINE.md`](../04_PLANNING_PIPELINE.md)).

## Локальные шаблоны (в этом каталоге)

| Шаблон | Файл | Для чего | Этап |
|--------|------|----------|------|
| ADR | [`adr.md`](adr.md) | запись архитектурного решения (`docs/adr/NNNN-*.md`) | 8–9 |
| Devlog | [`devlog.md`](devlog.md) | запись хода работ (`devlog/NN-*.md`) | все |
| Спека фичи | [`feature-spec.md`](feature-spec.md) | кросс-сервисная фича, spec (skill `platform-landing`) | — |
| План фичи | [`feature-plan.md`](feature-plan.md) | кросс-сервисная фича, план + прогресс | — |

Раскладка репозитория и форматы `CONTEXT.md`/ADR — [`../05_REPO_STRUCTURE.md`](../05_REPO_STRUCTURE.md).

## Внешние образцы-репозитории

| Образец | URL | Что берём | Скилл |
|---------|-----|-----------|-------|
| passkey-demo-api | <https://github.com/ubik-life/passkey-demo-api> | шаблон компонентных тестов + скелет сервиса (RED-ready) | `component-test-scaffold`, `component-tests` |
| pinout-openapi | <https://github.com/codemonstersteam/pinout-openapi> | образец `docs/design/<slice>/c4.md` + системный use case рядом | `c4`, `cockburn-use-case` |

> Внешние ссылки цитируются также в frontmatter/теле соответствующего скилла — этот файл держит
> единый реестр, чтобы не искать по скиллам.
