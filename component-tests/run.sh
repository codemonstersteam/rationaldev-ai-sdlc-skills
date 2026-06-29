#!/usr/bin/env sh
# Компонентные тесты харнеса. exit 0 = все прошли.
#   sh component-tests/run.sh
# 1) model-distribution — харнес раздаёт ролям модели по models.config.json (node).
# 2) proxy usage       — tokenproxy верно учитывает токены и метку модели (go test).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/2] model-distribution"
command -v node >/dev/null 2>&1 || { echo "FAIL: нужен node"; exit 1; }
node "$ROOT/component-tests/model-distribution/run.mjs"

echo "[2/2] proxy usage"
if command -v go >/dev/null 2>&1; then
  ( cd "$ROOT/experiments/token-bench/proxy/tokenproxy" && go test ./... )
else
  echo "SKIP: go не найден (go test пропущен)"
fi

echo "component-tests: OK"
