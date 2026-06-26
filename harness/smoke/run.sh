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

# --- Claude ---
P="$TMP/claude"; mkdir -p "$P"
sh "$REPO/install.sh" claude "$P" >/dev/null
[ "$(ls "$P/.claude/agents"/*.md 2>/dev/null | wc -l | tr -d ' ')" = 6 ] || fail "claude: ролей не 6"; ok
[ -f "$P/.claude/skills/memory/SKILL.md" ] || fail "claude: нет скилла memory"; ok
[ -e "$P/CLAUDE.md" ] || fail "claude: нет CLAUDE.md"; ok

# --- OpenCode ---
P="$TMP/opencode"; mkdir -p "$P"
sh "$REPO/install.sh" opencode "$P" >/dev/null
[ "$(ls "$P/.opencode/agent"/*.md 2>/dev/null | wc -l | tr -d ' ')" = 6 ] || fail "opencode: агентов не 6"; ok
[ -e "$P/AGENTS.md" ] || fail "opencode: нет корневого AGENTS.md"; ok

# --- Codex (сборка ролей в AGENTS.md) ---
P="$TMP/codex"; mkdir -p "$P"
sh "$REPO/install.sh" codex "$P" >/dev/null
[ "$(ls "$P/.agents/roles"/*.md 2>/dev/null | wc -l | tr -d ' ')" = 6 ] || fail "codex: ролей не 6"; ok
[ -f "$P/.agents/skills/memory/SKILL.md" ] || fail "codex: нет скилла memory"; ok
grep -q "Orchestrator" "$P/AGENTS.md" || fail "codex: в AGENTS.md нет orchestrator"; ok
grep -q "Hughes" "$P/AGENTS.md" || fail "codex: в AGENTS.md нет блоков ролей"; ok

# --- Недеструктивность: существующий AGENTS.md не затирать ---
P="$TMP/existing"; mkdir -p "$P"; printf 'ORIGINAL OPERATOR RULES\n' > "$P/AGENTS.md"
sh "$REPO/install.sh" codex "$P" >/dev/null
[ "$(head -1 "$P/AGENTS.md")" = "ORIGINAL OPERATOR RULES" ] || fail "existing AGENTS.md затёрт"; ok
[ -f "$P/AGENTS.harness.md" ] || fail "инструкции харнеса не положены рядом"; ok

# === enforcement (--hard) ===
GC="$REPO/harness/enforcement/claude/gate-check.sh"
LD="$REPO/harness/enforcement/claude/log-decision.sh"

# OpenCode --hard кладёт плагин
P="$TMP/oc-hard"; mkdir -p "$P"
sh "$REPO/install.sh" opencode "$P" --hard >/dev/null
[ -e "$P/.opencode/plugins/rational-guardrail.ts" ] || fail "opencode --hard: нет плагина"; ok

# Claude --hard кладёт хуки и settings
P="$TMP/cl-hard"; mkdir -p "$P"
sh "$REPO/install.sh" claude "$P" --hard >/dev/null
[ -e "$P/.claude/hooks/gate-check.sh" ] || fail "claude --hard: нет хука gate-check"; ok
grep -q "PreToolUse" "$P/.claude/settings.json" || fail "claude --hard: settings без хуков"; ok

# OpenCode-плагин: детерминированный смоук (Gate #1 + decisions.log)
node "$REPO/harness/enforcement/opencode/guardrail.smoke.ts" >/dev/null || fail "opencode guardrail smoke упал"; ok

# Claude gate-check: implementer без апрува → блок (exit != 0)
D="$TMP/gate-block"; mkdir -p "$D"
if ( cd "$D" && printf '{"tool_input":{"subagent_type":"implementer"}}' | sh "$GC" 2>/dev/null ); then fail "gate не заблокировал implementer без апрува"; fi; ok

# Claude gate-check: implementer с апрувом → проход
D="$TMP/gate-pass"; mkdir -p "$D/.agent/plan-reviewer" "$D/.agent/gates"
: > "$D/.agent/plan-reviewer/plan-review.md"; : > "$D/.agent/gates/gate1.approved"
( cd "$D" && printf '{"tool_input":{"subagent_type":"implementer"}}' | sh "$GC" ) || fail "gate заблокировал при апруве"; ok

# Claude gate-check: не-implementer проходит свободно
D="$TMP/gate-planner"; mkdir -p "$D"
( cd "$D" && printf '{"tool_input":{"subagent_type":"planner"}}' | sh "$GC" ) || fail "gate заблокировал planner"; ok

# Claude log-decision: дописывает decisions.log
D="$TMP/loghook"; mkdir -p "$D"
( cd "$D" && printf '{"tool_input":{"subagent_type":"planner"}}' | sh "$LD" )
grep -q "role=planner" "$D/.agent/decisions.log" || fail "log-decision не записал роль"; ok
grep -q "via=claude-hook" "$D/.agent/decisions.log" || fail "log-decision без метки via"; ok

echo "PASS $pass — harness smoke (установка + enforcement)"
