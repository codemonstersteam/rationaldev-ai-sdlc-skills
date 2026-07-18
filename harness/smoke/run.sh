#!/usr/bin/env sh
# Исполняемый смоук харнеса (@auto сценарии из harness.feature).
# Прогоняет install.sh во временные каталоги и проверяет раскладку.
# Маршрутизация ролей (@manual @model) — за оператором в живом раннере.
#
# Запуск: ./harness/smoke/run.sh
set -eu

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
ok()   { pass=$((pass + 1)); }
fail() { echo "FAIL: $1"; exit 1; }

# проекции в актуальном состоянии
node "$REPO/harness/gen-agents.mjs" >/dev/null

# Ожидаемое число ролей — из ИСТОЧНИКА ПРАВДЫ (_shared/*.md), не магическое число:
# добавил роль → счётчик подстроился сам, смоук не надо трогать.
NROLES="$(ls "$REPO/harness/agents/_shared"/*.md 2>/dev/null | wc -l | tr -d ' ')"

# реестр скиллов актуален + ссылки ролей (skills:) ведут на существующие stable-скиллы
node "$REPO/harness/gen-skill-index.mjs" --check >/dev/null || fail "skill-index: устарел или битая ссылка роль→скилл"; ok

# юнит-тесты чистых модулей харнеса (frontmatter, ядра валидаторов, resolveModel) — dogfood
export RATIONALDEV_UPDATE=off   # смоук не должен дёргать self-update autocheck (сеть/реальный клон)
node --test "$REPO"/harness/test/*.test.mjs >/dev/null 2>&1 || fail "harness unit-тесты (node --test) упали"; ok

# --- Claude ---
P="$TMP/claude"; mkdir -p "$P"
sh "$REPO/install.sh" claude "$P" --no-input >/dev/null
[ "$(ls "$P/.claude/agents"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "$NROLES" ] || fail "claude: ролей не $NROLES"; ok
[ -f "$P/.claude/skills/memory/SKILL.md" ] || fail "claude: нет скилла memory"; ok
[ -e "$P/CLAUDE.md" ] || fail "claude: нет CLAUDE.md"; ok
# назначение моделей из models.config.json применилось (дефолт claude → 3 модели)
grep -q '^model:' "$P/.claude/agents/wirth-planner.md" || fail "claude: модель из конфига не проставлена"; ok
# --hard: сгенерированный settings.json — ВАЛИДНЫЙ JSON (регресс: кавычки вокруг пути в command не экранировались)
sh "$REPO/install.sh" claude "$P" --no-input --hard >/dev/null
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$P/.claude/settings.json" 2>/dev/null || fail "claude --hard: settings.json — битый JSON"; ok
[ -f "$P/.claude/hooks/gate-approve.mjs" ] || fail "claude --hard: нет gate-approve хука"; ok

# --- OpenCode ---
P="$TMP/opencode"; mkdir -p "$P"
sh "$REPO/install.sh" opencode "$P" --no-input >/dev/null
[ "$(ls "$P/.opencode/agent"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "$NROLES" ] || fail "opencode: агентов не $NROLES"; ok
[ -e "$P/AGENTS.md" ] || fail "opencode: нет корневого AGENTS.md"; ok

# --- Codex (сборка ролей в AGENTS.md) ---
P="$TMP/codex"; mkdir -p "$P"
sh "$REPO/install.sh" codex "$P" --no-input >/dev/null
[ "$(ls "$P/.agents/roles"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "$NROLES" ] || fail "codex: ролей не $NROLES"; ok
[ -f "$P/.agents/skills/memory/SKILL.md" ] || fail "codex: нет скилла memory"; ok
grep -q "izi" "$P/AGENTS.md" || fail "codex: в AGENTS.md нет izi"; ok
grep -q "Hughes" "$P/AGENTS.md" || fail "codex: в AGENTS.md нет блоков ролей"; ok

# --- Недеструктивность: существующий AGENTS.md не затирать ---
P="$TMP/existing"; mkdir -p "$P"; printf 'ORIGINAL OPERATOR RULES\n' > "$P/AGENTS.md"
sh "$REPO/install.sh" codex "$P" --no-input >/dev/null
[ "$(head -1 "$P/AGENTS.md")" = "ORIGINAL OPERATOR RULES" ] || fail "existing AGENTS.md затёрт"; ok
[ -f "$P/AGENTS.harness.md" ] || fail "инструкции харнеса не положены рядом"; ok

# === enforcement (--hard) ===
# Хуки резолвят корень как CLAUDE_PROJECT_DIR || cwd; в смоуке корень = cwd подкаталога.
unset CLAUDE_PROJECT_DIR 2>/dev/null || true
GC="$REPO/harness/enforcement/claude/gate-check.mjs"
LD="$REPO/harness/enforcement/claude/log-decision.mjs"

# OpenCode --hard кладёт плагин
P="$TMP/oc-hard"; mkdir -p "$P"
sh "$REPO/install.sh" opencode "$P" --hard --no-input >/dev/null
[ -e "$P/.opencode/plugins/rational-guardrail.mjs" ] || fail "opencode --hard: нет плагина"; ok

# Claude --hard кладёт хуки и settings
P="$TMP/cl-hard"; mkdir -p "$P"
sh "$REPO/install.sh" claude "$P" --hard --no-input >/dev/null
[ -e "$P/.claude/hooks/gate-check.mjs" ] || fail "claude --hard: нет хука gate-check"; ok
grep -q "PreToolUse" "$P/.claude/settings.json" || fail "claude --hard: settings без хуков"; ok

# OpenCode-плагин: детерминированный смоук (Gate #1 + decisions.log)
node "$REPO/harness/enforcement/opencode/guardrail.smoke.ts" >/dev/null || fail "opencode guardrail smoke упал"; ok

# Claude gate-check: фронтдор — без brd.md роутить можно ТОЛЬКО @gilb
D="$TMP/frontdoor"; mkdir -p "$D"
if ( cd "$D" && printf '{"tool_input":{"subagent_type":"wirth-triage"}}' | node "$GC" 2>/dev/null ); then fail "фронтдор не заблокировал триаж без brd.md"; fi; ok
( cd "$D" && printf '{"tool_input":{"subagent_type":"gilb"}}' | node "$GC" ) || fail "фронтдор заблокировал @gilb (он и есть грил)"; ok

# Claude gate-check: implementer без апрува → блок (exit != 0) — brd.md уже есть, ловим Gate #1
D="$TMP/gate-block"; mkdir -p "$D/.agent/planner"; : > "$D/.agent/planner/brd.md"
if ( cd "$D" && printf '{"tool_input":{"subagent_type":"hughes"}}' | node "$GC" 2>/dev/null ); then fail "gate не заблокировал implementer без апрува"; fi; ok

# Claude gate-check: implementer с апрувом → проход (brd.md + plan-review + gate1)
D="$TMP/gate-pass"; mkdir -p "$D/.agent/plan-reviewer" "$D/.agent/gates" "$D/.agent/planner"
: > "$D/.agent/plan-reviewer/plan-review.md"; : > "$D/.agent/gates/gate1.approved"; : > "$D/.agent/planner/brd.md"
( cd "$D" && printf '{"tool_input":{"subagent_type":"hughes"}}' | node "$GC" ) || fail "gate заблокировал при апруве"; ok

# Claude gate-check: mode=chore — implementer требует durable docs/chores/<slug>/CHORE-PLAN.md (не .agent/) + gate1
D="$TMP/gate-chore"; mkdir -p "$D/.agent/gates" "$D/.agent/planner"
: > "$D/.agent/planner/brd.md"; printf chore > "$D/.agent/planner/mode"; : > "$D/.agent/gates/gate1.approved"
if ( cd "$D" && printf '{"tool_input":{"subagent_type":"hughes"}}' | node "$GC" 2>/dev/null ); then fail "chore: gate пропустил без CHORE-PLAN.md"; fi; ok
mkdir -p "$D/docs/chores/001-ci-on-pr"; : > "$D/docs/chores/001-ci-on-pr/CHORE-PLAN.md"
( cd "$D" && printf '{"tool_input":{"subagent_type":"hughes"}}' | node "$GC" ) || fail "chore: gate заблокировал при durable CHORE-PLAN.md + gate1"; ok

# Claude gate-check: не-implementer после фронтдора проходит свободно (brd.md есть)
D="$TMP/gate-planner"; mkdir -p "$D/.agent/planner"; : > "$D/.agent/planner/brd.md"
( cd "$D" && printf '{"tool_input":{"subagent_type":"wirth-planner"}}' | node "$GC" ) || fail "gate заблокировал planner"; ok

# Claude log-decision: дописывает decisions.log
D="$TMP/loghook"; mkdir -p "$D"
( cd "$D" && printf '{"tool_input":{"subagent_type":"wirth-planner"}}' | node "$LD" )
grep -q "role=wirth-planner" "$D/.agent/decisions.log" || fail "log-decision не записал роль"; ok
grep -q "via=claude-hook" "$D/.agent/decisions.log" || fail "log-decision без метки via"; ok

# Раздача моделей по ролям (тир + оверрайд + наследование), самовосстановление конфига
node "$REPO/component-tests/model-distribution/run.mjs" >/dev/null || fail "model-distribution: роли получили неверные модели"; ok

# self-update: `rationaldev update` (T3 — ff-pull, up-to-date, pristine-abort)
__ro="$(sh "$REPO/harness/smoke/rationaldev.smoke.sh" 2>&1)" || { printf '%s\n' "$__ro"; fail "rationaldev update smoke упал"; }; ok

echo "PASS $pass — harness smoke (установка + enforcement + модели + self-update)"
