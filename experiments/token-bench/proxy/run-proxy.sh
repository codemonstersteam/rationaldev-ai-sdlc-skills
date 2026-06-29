#!/usr/bin/env sh
# Запуск token-logging прокси. Источает proxy.config (+ .env, если есть).
# Ключ провайдера живёт у OpenCode (прокси лишь форвардит заголовки в UPSTREAM_URL).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -x "$HERE/bin/tokenproxy" ] || { echo "нет bin/tokenproxy — запусти sh bench/setup.sh"; exit 1; }
set -a
. "$HERE/proxy.config"
[ -f "$HERE/.env" ] && . "$HERE/.env"
set +a
# абсолютный путь лога (bench.sh ждёт его же)
case "${PROXY_LOG:-usage.jsonl}" in /*) : ;; *) PROXY_LOG="$HERE/${PROXY_LOG:-usage.jsonl}" ;; esac
export PROXY_LOG
echo "tokenproxy → :$PORT  upstream=$UPSTREAM_URL  log=$PROXY_LOG"
exec "$HERE/bin/tokenproxy"
