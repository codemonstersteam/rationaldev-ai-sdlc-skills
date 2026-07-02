#!/usr/bin/env sh
# Сброс песочницы в ЧИСТОЕ состояние перед каждым прогоном харнеса.
# Whitelist: оставляет только вход (TASK.md) + установку харнеса (.opencode, harness, AGENTS.md) + .git;
# сносит ВСЁ сгенерированное (.agent, docs, api-specification, component-tests, scaffold-код
# cmd/internal/go.*, config.yaml, README.md, services.yaml, бинари и т.п.).
#
# Запуск: sh clean-sandbox.sh <sandbox-dir> [--logs]
#   --logs — заодно обнулить usage.jsonl/flow.jsonl прокси.
set -eu
SB="${1:?usage: clean-sandbox.sh <sandbox-dir> [--logs]}"
[ -d "$SB" ] || { echo "нет каталога $SB"; exit 1; }
KEEP=" TASK.md AGENTS.md .opencode harness .git "

for e in "$SB"/* "$SB"/.[!.]*; do
  [ -e "$e" ] || continue                       # незаматченный glob → пропуск
  n="$(basename "$e")"
  case "$KEEP" in *" $n "*) continue ;; esac    # в whitelist — оставить
  rm -rf "$e"
done
echo "sandbox чист: $(ls -A "$SB" | grep -v '^\.git$' | tr '\n' ' ')"

if [ "${2:-}" = "--logs" ]; then
  P="$(cd "$(dirname "$0")/../proxy" && pwd)"
  : > "$P/usage.jsonl"; : > "$P/flow.jsonl"
  echo "логи прокси обнулены ($P/{usage,flow}.jsonl)"
fi
