#!/usr/bin/env sh
# Claude Code PreToolUse-хук на инструмент Task.
# Жёсткий Gate #1: блокирует делегирование роли implementer, пока план не принят.
# Вход: JSON на stdin (tool_name, tool_input{subagent_type,...}). cwd = каталог проекта.
# Выход: exit 2 → Claude блокирует вызов и показывает stderr модели.
input="$(cat)"
role="$(printf '%s' "$input" | grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
[ "$role" = "implementer" ] || exit 0
if [ ! -f ".agent/plan-reviewer/plan-review.md" ] || [ ! -f ".agent/gates/gate1.approved" ]; then
  echo "[rational-guardrail] Gate #1 не пройден: нужны .agent/plan-reviewer/plan-review.md и .agent/gates/gate1.approved перед делегированием implementer." >&2
  exit 2
fi
exit 0
