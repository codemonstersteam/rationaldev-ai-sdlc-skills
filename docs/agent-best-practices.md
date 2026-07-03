# Best-practices разработки агентов (2025–2026) — источники и рекомендации

> Внешний ориентир для харнеса rationaldev: что индустрия считает надёжным способом
> строить агентов, и как это ложится на наши решения (роли-как-модули, гейты, минимизация
> контекста, детерминированные валидаторы). Сведено из первичных инженерных публикаций
> Anthropic / OpenAI / Cognition / HumanLayer и обзоров по контекст-инжинирингу и оценке.
> Обновлено: 2026-07.

## Источники (по темам)

### Фундамент / архитектура
- Anthropic — [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
  (+ [PDF: Architecture Patterns & Implementation](https://resources.anthropic.com/hubfs/Building%20Effective%20AI%20Agents-%20Architecture%20Patterns%20and%20Implementation%20Frameworks.pdf))
  — workflow vs agent, паттерны оркестрации, «начинай просто».
- OpenAI — [A Practical Guide to Building Agents (PDF)](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
  — когда строить агента, дизайн-основы, guardrails.
- HumanLayer — [12-Factor Agents (GitHub)](https://github.com/humanlayer/12-factor-agents)
  — 12 принципов надёжных LLM-приложений: own your prompts / context / control-flow, stateless.

### Контекст-инжиниринг (ядро надёжности)
- Anthropic — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  — «наименьший высокосигнальный набор токенов».
- Sourcegraph — [Context Engineering: A Practical Guide (2026)](https://sourcegraph.com/blog/context-engineering).
- mem0 — [Context Engineering AI: Smarter LLM Agents](https://mem0.ai/blog/context-engineering-ai-agents-guide)
  — write / select / compress / isolate, «context rot».

### Инструменты и скиллы
- Anthropic — [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents).
- Anthropic — [Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
  · [Claude docs: Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
  — **progressive disclosure**: discovery → activation → execution.

### Один vs много агентов (дебат)
- Cognition — [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents)
  — единый связный контекст; «share full traces, not messages».
- Anthropic — [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
  — orchestrator + изолированные субагенты, +90 % на breadth-задачах.
- Обзоры: [The AI Agent Architecture Debate (McGuinness)](https://patmcguinness.substack.com/p/the-ai-agent-architecture-debate)
  · [Single vs Multi-Agents (Phil Schmid)](https://www.philschmid.de/single-vs-multi-agents).

### Оценка (evals)
- Confident AI — [LLM Agent Evaluation (2026)](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide).
- LangChain — [LLM Evaluation: Trajectories vs Outputs](https://www.langchain.com/resources/llm-evaluation-framework).
- arXiv — [Agent-as-a-Judge](https://arxiv.org/html/2508.02994v1).

## Основные рекомендации (сведено) и привязка к харнесу

| # | Рекомендация индустрии | Как ложится на rationaldev |
|---|---|---|
| 1 | **Начинай просто; агентность — только если окупается.** Workflow (детерминированные пути) где можно, агент — где нужна динамика. | `izi` = механический роутер + детерминированные валидаторы = «код + точки LLM-решений». ✅ |
| 2 | **Контекст-инжиниринг — главная дисциплина.** Наименьший высокосигнальный набор токенов; борьба с «context rot» и «dumb zone» (середина большого окна, где падает recall). | Оправдывает `skill-as-tool` и `run-summary`/baseline: ~10 % input на встроенных скиллах — удаляемый шум. |
| 3 | **Own prompts / context-window / control-flow; агент stateless; разделяй business- и execution-state.** | Роли-как-модули + `.agent/decisions.log` как внешнее состояние. Пробел: строгая stateless-резюмируемость ролей. |
| 4 | **Инструментам — столько же внимания, сколько промптам.** Мало, но качественных тулов; токен-экономный вывод (ID/срезы, не дампы). | Ревизия `bash "*": allow` и объёмов, что роли льют в контекст. |
| 5 | **Скиллы через progressive disclosure:** в контексте только name+description, тело — при активации; большие SKILL.md дробить на файлы «по требованию». | Буквально `skill-as-tool` + правило «SKILL ≤300 строк». Сейчас тела встраиваются целиком — анти-паттерн, который отрасль отвергла. |
| 6 | **Один агент по умолчанию; мульти — под форму задачи** (параллельный breadth), с orchestrator + **изолированными** субагентами. **Делись полными трейсами, не отдельными сообщениями**; не дроби контекст наивно. | Flat-архитектура (`izi` depth-1) — разумный компромисс. Риск Cognition (субагент теряет нюанс) лечим замороженным контрактом + тикетами с явными `inputs`. |
| 7 | **Human-in-the-loop на нужных гейтах, не везде.** | Три гейта (акцепт плана / мерж / приёмка) — по канону. ✅ |
| 8 | **Guardrails слоями + детерминированные проверки + sandbox.** | `rational-guardrail` + `validate-*` + antecedent-валидация. Усиление — модульные тестируемые хуки. |
| 9 | **Оценка на трёх уровнях: end-to-end / trajectory / component.** Trajectory (путь: вызовы тулов, ретраи) важнее одного финального ответа; LLM-as-judge с рубриками и калибровкой. | **Дыра:** `run-summary` даёт метрики, но нет eval-рубрики «прошёл / эффективно / безопасно». Кандидат в задачу. |
| 10 | **Промпт — главный рычаг; наблюдай агента пошагово; вшивай численные эвристики** (Anthropic: 1 агент на факт, 2–4 на сравнение, >10 на сложное). | Триаж `trivial/modular/epic` — та же идея; стоит вшить численные пороги. |
| 11 | **Надёжность = детерминированный код + стратегические LLM-точки**, не «агент решает всё». | Сдвиг механики к скриптам (`scaffold.sh`, io-router, валидаторы). ✅ |
| 12 | **Ошибки / ретраи / компакция — граждане первого класса.** | `izi` «устойчивость к обрывам» пока проза; сделать ENFORCED-хуком (12-factor согласен). |

## Главный вывод

Харнес уже попадает в консенсус-2026: **детерминизм + гейты + роли-как-модули + минимизация
контекста**. Две самые «отраслевые» недоработки к закрытию:

1. **Progressive disclosure для скиллов** — тела грузить по требованию, а не встраивать
   (экономия токенов + рантайм-гарантия «ровно нужный скилл»).
2. **Trajectory / eval-слой** поверх `run-summary` — LLM-as-judge по рубрике
   (успех / эффективность пути / безопасность), а не только метрики токенов.
