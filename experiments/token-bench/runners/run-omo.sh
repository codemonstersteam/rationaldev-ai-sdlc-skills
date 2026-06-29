#!/usr/bin/env sh
# Один прогон харнеса omo (oh-my-openagent) в песочнице (headless OpenCode).
# Usage: run-omo.sh <sandbox> <run_id>
# Предусловия (см. bench/README.md): omo установлен как плагин OpenCode в этой песочнице
# (по инструкции его репозитория), `opencode` доступен, baseURL → тот же прокси.
# omo автономен: человеческих гейтов rational-agents у него нет, авто-аппрув не нужен.
set -eu
SB="${1:?usage: run-omo.sh <sandbox> <run_id>}"
RUN="${2:?run_id}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TASK="$HERE/../spec/task.md"

# Установка omo — вне этого скрипта (разовая, по инструкции omo). Пример (уточни актуальную):
#   opencode plugin add oh-my-openagent
# Здесь предполагается, что omo уже активен для песочницы.

( cd "$SB" && opencode run "$(cat "$TASK")" ) || true
