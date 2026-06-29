#!/usr/bin/env sh
# Сброс песочницы перед прогоном: чистый Go-модуль + входная фикстура, без следов харнеса.
# Usage: reset.sh <sandbox>
set -eu
SB="${1:?usage: reset.sh <sandbox>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$SB"
mkdir -p "$SB"
printf 'module bench-task\n\ngo 1.26\n' > "$SB/go.mod"   # фиксированный модуль = меньше вариативности
cp "$HERE/../fixture/services.yaml" "$SB/services.yaml"  # вход сервиса
cp "$HERE/../spec/task.md" "$SB/TASK.md"                 # задача в cwd (иначе агент ищет снаружи)
rm -rf "$SB/.opencode" "$SB/.agent"                      # чистое состояние харнеса/цикла
echo "reset → $SB"
