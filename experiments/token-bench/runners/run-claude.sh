#!/usr/bin/env sh
# Claude-арм эксперимента: голый Claude Code (baseline) ИЛИ харнес rationaldev в Claude Code.
# Usage: run-claude.sh <plain|harness> <sandbox>
#   plain   — Claude Code без харнеса (как «Claude сам справится»)
#   harness — install.sh claude <sb> → .claude/agents + CLAUDE.md, ведёт по ролям харнеса
# Замер токенов: если Claude Code honor'ит ANTHROPIC_BASE_URL — пойдёт через прокси; иначе сними
# из `/cost` сессии (оговорка метода в RUNBOOK.md). Ключ — из env, не в гит.
set -eu
MODE="${1:?usage: run-claude.sh <plain|harness> <sandbox>}"
SB="${2:?usage: run-claude.sh <mode> <sandbox>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$(cd "$HERE/../../.." && pwd)"
command -v claude >/dev/null || { echo "нужен Claude Code CLI (claude)"; exit 1; }

sh "$HERE/reset.sh" "$SB" >/dev/null
[ "$MODE" = harness ] && ( cd "$BUNDLE" && sh install.sh claude "$SB" >/dev/null ) || true

cd "$SB"
PROMPT='Read ./TASK.md in the CURRENT directory and implement it fully HERE per its requirements (modular service with internal/ packages, OpenAPI in api-specification/, config from file/env no hardcode, Gherkin component tests in Docker via godog, unit tests, README with failure-mode map). Done = sh ./run-tests.sh exits 0.'
echo "→ Claude Code [$MODE] в $SB (headless)"
claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$SB/claude-run.log"
echo "готово. оцени: sh experiments/token-bench/acceptance/check.sh $SB ; стоимость — из /cost или лога прокси"
