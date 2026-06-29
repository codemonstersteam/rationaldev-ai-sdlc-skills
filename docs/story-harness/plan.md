# План: превратить rationaldev-ai-sdlc-skills в мультиагентный харнес

> Цель — из набора SDLC-ролей и скиллов сделать **подключаемый мультиагентный
> харнес** для трёх раннеров: **Claude Code, Codex CLI, OpenCode**. Один источник
> правды → три цели. Харнес сознательно **упрощён** (config-first, без тяжёлого
> рантайма). Статус: **на пруф оператора**, реализация после апрува.

## 1. Outcome

Разработчик ставит задачу в любом из трёх раннеров → получает команду SDLC-ролей
(planner/Wirth → plan-reviewer → implementer/Hughes → fixer/Linger → release-health/Michtom)
с нужными скиллами и человеческими гейтами, **без ручного переключения агентов**.
Подключение — одной командой, глобально или в проект.

## 2. Решение (по аналогии, кратко)

| Развилка | Вывод |
|---|---|
| Тяжёлый рантайм (omo-подобный) | ❌ — token-bloat, противоречит нашему фрейму |
| Свой источник правды | ✅ `skills/roles/*` + `skills/lib/*` уже markdown, harness-agnostic |
| Раннеры | Claude / OpenCode / Codex грузят агентов и скиллы из markdown нативно |

**Подход:** config-first. Единый источник (роли + скиллы) **проецируется** в раскладку
каждого раннера установщиком. Никакого TS-плагина в MVP — гейты и `decisions.log`
живут как инструкции в промптах (enforce-слой — опционально, позже).

## 3. Кросс-раннер раскладка

Общий знаменатель: `.agents/skills/<name>/SKILL.md` читают **и OpenCode, и Codex**;
Claude использует `.claude/skills/`. Инструкции: Claude → `CLAUDE.md`, OpenCode/Codex → `AGENTS.md`.

| Раннер | Роли (агенты) | Скиллы | Инструкции/роутер | Делегирование |
|---|---|---|---|---|
| **Claude Code** | `.claude/agents/<role>.md` | `.claude/skills/<n>/` | `CLAUDE.md` | нативное (Task, авто) |
| **OpenCode** | `.opencode/agent/<role>.md` | `.opencode/skills/<n>/` (и `.agents/skills`) | `AGENTS.md` | нативный `task` + `task_budget`/depth |
| **Codex CLI** | субагенты (промпт/конфиг) | `.agents/skills/<n>/` | `AGENTS.md` (root или `~/.codex/AGENTS.md`) | субагенты Codex |

**Global vs project:**

| Раннер | Глобально | В проект |
|---|---|---|
| Claude | `~/.claude/agents`, `~/.claude/skills` | `.claude/agents`, `.claude/skills` |
| OpenCode | `~/.config/opencode/{agent,skills}` | `.opencode/{agent,skills}` |
| Codex | `~/.codex/AGENTS.md`, `~/.agents/skills` | `AGENTS.md`, `.agents/skills` |

## 4. Состав ролей (источник — `skills/roles/`)

6 ролей, honorary-имена сохраняем: **Wirth** (planner), plan-reviewer, **Hughes**
(implementer), **Linger** (fixer), **Michtom** (release-health), **Witt** (orchestrator —
человек/роутер). Скилл `memory` уже подключён к Ralph-Loop ролям (в `main`).

Оркестратор = точка входа: классифицирует уровень задачи → ведёт по ролям → держит
human-gates. Параллель — только независимые слайсы эпика.

## 5. Бэклог (упрощённый, слайсами по TBD)

| Slice | Что | Артефакт |
|---|---|---|
| **0. План + концепт** | этот документ; решение config-first, single-source→3 раннера | `docs/story-harness/plan.md` |
| **1. Источник → агенты** | спроецировать 6 ролей в формат агента под каждый раннер (frontmatter: `description`, `mode`/role, `model`-тир); скиллы уже `SKILL.md` | `harness/agents/<runner>/` или генератор |
| **2. install.sh** | `./install.sh <claude\|codex\|opencode> [--global \| <project>] [--hard]` — кладёт роли+скиллы+инструкции в раскладку раннера (симлинки); `--hard` доустанавливает enforcement-адаптер раннера (Slice 6) | `install.sh` |
| **3. Роутер/инструкции** | `CLAUDE.md` / `AGENTS.md` с секцией оркестратора: классификация уровня, цепочка ролей, human-gates, memory, `decisions.log` — как инструкции | per-runner шаблоны |
| **4. README «Как начать»** | быстрый старт + матрица установки (global/project × 3 раннера) | `docs/story-harness/README.md` |
| **5. Gherkin-смоук харнеса** | `.feature`: `@auto` — установка (Given раннер+scope → Then раскладка верна, runnable-степы по `install.sh`) + `@manual @model` — маршрутизация ролей (planner→plan-reviewer→implementer) | `component-tests/harness.feature` + runner |
| **6. Enforcement per-runner (`--hard`)** | жёсткие гейты + гарантированный `decisions.log` там, где раннер умеет. **OpenCode** → TS-плагин (`tool.execute.before/after`). **Claude** → хуки в `settings.json` (`PreToolUse` блок + `PostToolUse` лог, shell). **Codex** → остаётся на инструкции (хук-поверхность бедна) | `harness/enforcement/<runner>/` |

База (Slice 0–5) — enforcement **инструкцией**, единообразно на всех трёх. Slice 6 —
**опциональный** `--hard`: одинаковое поведение через РАЗНЫЕ механизмы (плагин/хуки),
где раннер это поддерживает; Codex по-прежнему на инструкции. Роутинг — инлайн в инструкциях.
Gherkin-смоук сохранён (проект Gherkin-first, `AGENTS.md` §6). Сервисный `component-tests/`
(godog) не затрагивается — он про сервисы, не про харнес.

## 6. Инструкция «как начать» (целевой вид, заполняется в Slice 4)

```sh
# выбрать раннер и область установки
./install.sh opencode --global        # глобально для всех проектов
./install.sh claude   ~/myproject     # в конкретный проект
./install.sh codex                    # в текущий проект

# затем запустить раннер; точка входа — роль orchestrator (Witt)
```

## 7. Открытые вопросы (уточнить в Slice 1–2)

- Точный механизм субагентов Codex (конфиг vs промпт) — сверить по `developers.openai.com/codex`.
- Нужен ли единый генератор `agents/<runner>/` из `skills/roles/` или достаточно статических файлов + install-маппинга.
- `--hard`-enforcement (Slice 6) — порядок реализации: сперва OpenCode-плагин, затем Claude-хуки; Codex — инструкция.

## 8. Один репозиторий (не три)

**Один репо, мульти-таргет.** Источник правды общий; раннеры различаются только
упаковкой и enforcement-адаптером. Три репо = дублирование ролей/скиллов и дрейф.

```
rationaldev-ai-sdlc-skills/        # этот репозиторий
├── skills/roles/                  # 6 ролей — ИСТОЧНИК ПРАВДЫ
├── skills/lib/                    # скиллы (+ memory) — ИСТОЧНИК ПРАВДЫ
├── harness/
│   ├── agents/{claude,opencode,codex}/   # проекции ролей под раннер (Slice 1)
│   ├── instructions/{CLAUDE.md,AGENTS.md}# роутер-шаблоны (Slice 3)
│   └── enforcement/                       # --hard, Slice 6
│       ├── opencode/   # TS-плагин (tool hooks)
│       ├── claude/     # settings.json + shell-хуки
│       └── codex/      # README: почему инструкция, без enforce
├── install.sh                     # ./install.sh <runner> [--global|<proj>] [--hard]
├── component-tests/harness.feature# Gherkin-смоук харнеса (Slice 5)
└── docs/story-harness/            # этот план + README «как начать»
```

Пользовательский контракт: `git clone` → `./install.sh <runner> [--global|<proj>] [--hard]` → работа.

---

**Жду пруфа.** После апрува — Slice 1 (источник → агенты), ветка `feat/harness-slice-1`.
