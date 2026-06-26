#!/usr/bin/env sh
# Claude Code PostToolUse-хук на инструмент Task.
# Гарантированный decisions.log: дописывает строку на каждое делегирование роли.
# Вход: JSON на stdin (tool_input{subagent_type}). cwd = каталог проекта.
input="$(cat)"
role="$(printf '%s' "$input" | grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
[ -n "$role" ] || exit 0
mkdir -p .agent
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s\trole=%s\tvia=claude-hook\n' "$ts" "$role" >> .agent/decisions.log
exit 0
