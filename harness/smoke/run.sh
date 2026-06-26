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

echo "PASS $pass/11 — harness install smoke"
