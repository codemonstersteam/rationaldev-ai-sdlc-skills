# Описание роли — frontmatter + тело

Роль = system-prompt, спроецированный под раннер. **Источник правды** —
`harness/agents/_shared/<role>.md` = **frontmatter (YAML)** + **тело (markdown)**. Из
одного источника генерятся проекции claude/opencode/codex и человекочитаемый контракт роли
(`skills/roles/<role>/<role>.md`). Конвенция стоит на
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents) с нашими доп-полями.

## Кто что читает

| | **Frontmatter** (YAML) | **Тело** (markdown) |
|---|---|---|
| Читает | **харнес**: `gen-agents.mjs`, реестр, раннер | **модель** — это её system-prompt |
| Это | машиночитаемая идентичность + конфиг | поведение роли |
| Содержит | `tier`→модель, `mode`, `temperature`, `steps`, `skills:` (что грузить по имени), `inputs/outputs` (артефакты пайплайна), `permission:` (что можно править), `description` (роутинг) | что роль делает, порядок работы, STOP-правила, гейты, хендофф; ссылки на скиллы по имени |
| Проверяется | CI: `gen-skill-index --check` (скиллы существуют/`stable`, целостность пайплайна), `gen-agents` (обязательные поля, валидный `tier`) | машинно не валидируется (проза) |

## Чего НЕ должно быть

- Во **frontmatter** — прозы, инструкций «как себя вести», примеров.
- В **теле** — конфига (модель/права/temperature) и **дублирования содержимого скиллов**:
  грузи по имени, не вставляй процедуру внутрь. Полные процедуры живут в `skills/`, роль их
  только **перечисляет**.

## Зачем разделять

- **frontmatter** — конфиг, который машина читает и валидирует, и из одного источника
  проецирует под все раннеры;
- **тело** — промпт, который модель исполняет.

Так роль остаётся тонкой: «кто я, какой моделью, что гружу, что на входе/выходе, что можно
править» + «как веду задачу», а тяжёлая дисциплина — в скиллах.

## Пример: orchestrator (дирижёр-роутер)

```yaml
role: orchestrator
tier: large        # → opus
mode: primary      # точка входа, не субагент
skills: [memory, platform-landing]
permission: { edit: { ".agent/**": allow, "*": deny } }
```

**Тело:** таблица классификации уровня (пустой проект / тривиальный / модульный / эпик) →
делегирование субагентам → удержание Human Gates. Не пишет код и не проектирует.

## Пример: implementer (Hughes)

```yaml
role: implementer
tier: small        # → haiku (объём генерации по готовому плану)
mode: subagent
skills: [program-implementation, component-tests, code-style, git-conventions, memory, …]
permission: { edit: { "tests/**": ask, ".ci/**": ask, "*": allow } }
inputs: [.agent/planner/plan.md, .agent/planner/design, gate1]
outputs: [pr, .agent/decisions.log]
```

**Тело:** «пиши код строго по утверждённому плану; 1 срез = 1 PR; STOP при неполном пакете
или неаппрувленном хендоффе; запрет gaming (не менять тесты/CI ради зелёного)».

## Тиры моделей (S/M/L)

`large` = `opus` · `medium` = `sonnet` · `small` = `haiku`. Тир — **абстракция размера**;
`opus/sonnet/haiku` — её claude-рендер (другие раннеры маппят те же тиры на свои модели).
Раскладка: planner/plan-reviewer/fixer/orchestrator = large; release-health = medium;
implementer = small.

## Первоисточники

- Claude Code Subagents — https://code.claude.com/docs/en/sub-agents
- Building effective agents — https://www.anthropic.com/engineering/building-effective-agents
- Механика проекций — [`harness/README.md`](../../harness/README.md)
