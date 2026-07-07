# RUNBOOK — как запустить эксперимент (оператор или агент)

Пошаговая инструкция для **агента, запускающего прогон в песочнице**. Все пути — относительно
корня репозитория. Секреты — только в `proxy/.env` (в `.gitignore`), в гит не коммитить.

## 0. Предусловия
- Инструменты: `go`, `jq`, `curl`, `docker` (запущен), `tmux`. Для армов — `opencode` и/или
  `claude` (Claude Code), для арма omo — глобально установленный `oh-my-openagent`.
- Ключ провайдера: `cp proxy/.env.example proxy/.env` и вписать `ANTHROPIC_API_KEY`. Также
  `export ANTHROPIC_API_KEY=...` в окружении.

## 1. Настройка стенда
```sh
sh experiments/token-bench/setup.sh      # проверит среду, соберёт прокси, самопроверит стоп-линию
```

## 2. Поднять прокси токенов (терминал A)
```sh
sh experiments/token-bench/proxy/run-proxy.sh    # слушает :4000, лог → proxy/<arm>.jsonl (задай PROXY_LOG)
```
Направить OpenCode на прокси: чистый XDG-конфиг с baseURL (`/v1` обязателен):
```sh
mkdir -p /tmp/xdg-bench/opencode
printf '{ "$schema":"https://opencode.ai/config.json", "provider":{"anthropic":{"options":{"baseURL":"http://localhost:4000/v1"}}} }\n' \
  > /tmp/xdg-bench/opencode/opencode.json
export XDG_CONFIG_HOME=/tmp/xdg-bench
```
> Claude Code: если honor'ит `ANTHROPIC_BASE_URL` — `export ANTHROPIC_BASE_URL=http://localhost:4000/v1`;
> иначе снимай стоимость из `/cost` сессии (оговорка метода).

## 3. Прогон арма (терминал B)
ВАЖНО: для каждого арма — **свой** лог токенов (не затирать):
```sh
SB=/tmp/sb-opencode
PROXY_LOG=experiments/token-bench/proxy/opencode.jsonl   # отдельный файл!
# OpenCode + харнес:
sh experiments/token-bench/runners/run.sh opencode "$SB"
# omo (XDG = глобальный конфиг omo с baseURL; не /tmp/xdg-bench):
sh experiments/token-bench/runners/run.sh omo /tmp/sb-omo
# Claude:
sh experiments/token-bench/runners/run-claude.sh harness /tmp/sb-claude-harness
sh experiments/token-bench/runners/run-claude.sh plain   /tmp/sb-claude-plain
```
Раннер `run.sh` сам ставит харнес, вшивает модели по тирам, авто-аппрувит Gate #1, авто-allow'ит
permission-промпты, пишет «скриншоты» в `<SB>/tmux.log`. Следи: `tmux attach -t bench-opencode`.

## 3b. Ведение прогона агентом (драйв — оператору «чтоб не скучать»)
При ручном/наблюдаемом прогоне (агент ведёт, оператор акцептует гейты) — отчёты **драйвовые и
стат-богатые**, каждые ~3 мин + на событиях:
- **📊-заголовок** + № + время; терсно, эмодзи для сканируемости.
- **Прогресс-бар пайплайна** до гейта: `✅ triage ✅ intake ⬜ moduledesigner … → 🚦 Gate #1`
  (считать `role=X` в `.agent/decisions.log`); «сейчас X, дальше Y».
- **Экономика:** `N вызовов · in M · out K · $` + сплит по моделям. jq-ключи ТОЛЬКО ASCII (кириллица ломает jq).
- **Здоровье:** свежесть последнего вызова · сторож-504 · ошибок в `opencode.log` · Gate-статус.
- **Называй впереди точки валидации** («дальше ticketer — проверю cmd/app»; «mills — пишет ли review»).
- **На Gate #1 — покажи PLAN.md summary** (izi выводит дословно) и жди оператора; гейты НЕ прокликивай.
- Фон-хартбит: `sleep`-луп в `run_in_background`, ловит permission/poka-yoke/Gate#1-вопрос рано, иначе TICK 180с.
- Сетевой 504 роняет turn izi → сторож `runners/watch-izi-resume.sh` (короткий однострочный нудж; длинный
  встаёт QUEUED). Диагностика столла — `~/.local/share/opencode/log/opencode.log`, не по прокси.

## 4. Оценка и замер
```sh
sh experiments/token-bench/acceptance/check.sh "$SB"        # арбитр: PASS/FAIL
sh experiments/token-bench/inventory.sh "$SB"               # сколько/каких тестов
# токены арма:
jq -s '{calls:length, out:(map(.completion_tokens)|add), in:(map(.input_tokens)|add)}' \
  experiments/token-bench/proxy/opencode.jsonl
```
Стоимость `$` бери из TUI/`/cost` (включает input+кэш — честный сигнал). Время — из таймстемпов
`ts` в логе прокси (span − максимальный разрыв = активное, без простоя на пополнение кредитов).

### 4b. Eval-вердикт траектории (ОБЯЗАТЕЛЬНО, #42)
Кто/где сломался и почему — не только метрики. Вход — `flow.jsonl` (+`usage.jsonl`) прогона в
`experiments/token-bench/proxy/` (или свой `<logdir>`):
```sh
LOG=experiments/token-bench/proxy
node experiments/token-bench/runners/run-summary.mjs         "$LOG"   # скиллы/токены/MUST (как раньше)
node experiments/token-bench/runners/eval-run.mjs            "$LOG"   # ГЕЙТ: exit≠0 на safety-нарушении
node experiments/token-bench/runners/skill-embedding-cost.mjs "$LOG"  # встраивание скиллов (#40)
```
`eval-run` — детерминированный (эффективность: турны/кривые tool-calls/токены; безопасность: правки
тестов-CI/касание gate1/самосертификация по args; успех: возвратная строка). **`exit 1` = safety-провал**
прогона — разбирать до сохранения.

Субъективный вердикт (LLM-судья по якорной рубрике) — при наличии эндпоинта крупной модели:
```sh
export EVAL_JUDGE_URL=… EVAL_JUDGE_MODEL=z-ai/glm-5.2 EVAL_JUDGE_KEY=…
node experiments/token-bench/runners/eval-judge.mjs "$LOG"            # eff/succ/safe 1..5 + verdict
# без эндпоинта: `--payload` (дайджесты) или `--rubric` → скорми внешнему судье/агенту
```
Разбор вердиктов — как в `eval-verdicts-baseline.md` (пример: scaffolder выжигает лимит шагов, PR нет).
> Полный «успех» (наличие `outputs` по контракту роли) — на снапшоте `.agent/**` прогона; из
> `flow.jsonl` он частичный (по `final_output`).

## 5. Сохранить результат (ВНЕ гита)
Сырые прогоны, реализации сервисов, `usage.jsonl`/`flow.jsonl`, секреты — **не коммитить**. Складывай
рядом с репо в **`../test-harnes-data/<dd-mm-yyyy>/<N>-harnes/`** (N — номер теста). **Бинари не хранить.**

Раскладка:
```
<N>-harnes/
├── project/       — исходники сервиса (cmd, internal, component-tests, api-specification,
│                    docs/design+tickets, Dockerfile, docker-compose.yml, README, config)
│                    БЕЗ бинарей/.git/.opencode/.agent
├── agent-trace/   — decisions.log, planner (frd/slices/PLAN/done.log), plan-reviewer (вердикт mills)
├── proxy/         — flow.jsonl + usage.jsonl (полные логи прогона)
├── analysis.md    — метрики (чистое время/деньги/токены/вызовы) + разбивка планирование vs реализация
│                    + декомпозиция + валидированные фиксы + найденные проблемы + качество
└── models.md      — роль→модель + наблюдения
```
Копирование проекта без бинарей — `rsync` с whitelist расширений (excludes ПЕРЕД include):
`rsync -am --exclude='.git/**' --exclude='.opencode/**' --exclude='.agent/**' --exclude='harness/**'
--include='*/' --include='*.go' --include='*.yaml' --include='*.yml' --include='*.md' --include='Dockerfile*'
--include='*.feature' --include='*.sh' --include='go.mod' --include='go.sum' --exclude='*' <sb>/ <dest>/project/`.
Метрики/разбивку по фазам считать из `usage.jsonl` (сплит по маркеру `.agent/gates/gate1.approved`).
Пример готового архива: `../test-harnes-data/03-07-2026/1-harnes/`.

## 6. Новый прогон / доработанная задача
- Правь `spec/task.md` (это BRD; FRD генерит сам харнес скиллом `requirements-intake`).
- Заводи новую папку результатов `test<N>/`. Спеку держи замороженной в пределах одного теста.
- Перед каждым армом — `reset.sh` чистит песочницу (он внутри `run.sh`).

## Армы и установка (справка)
| Арм | команда |
|---|---|
| Харнес OpenCode | `runners/run.sh opencode <sb>` (`install.sh opencode <sb> --hard`) |
| omo | `runners/run.sh omo <sb>` (глобальный omo) |
| Харнес Claude | `runners/run-claude.sh harness <sb>` (`install.sh claude <sb>`) |
| Голый Claude | `runners/run-claude.sh plain <sb>` |
