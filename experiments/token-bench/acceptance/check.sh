#!/usr/bin/env sh
# Стоп-линия бенча — ЕДИНСТВЕННЫЙ арбитр «готово» (одинаковый для обоих харнесов).
# Usage: check.sh <service_dir>
#   <service_dir> — каталог с написанным агентом Go-сервисом (package main в корне).
# Exit 0 = PASS: go build зелёный, сервис поднялся, GET /services?sort=platform,service == эталон.
set -eu

DIR="${1:?usage: check.sh <service_dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
EXPECTED="$HERE/../fixture/expected.json"
FIXTURE="$HERE/../fixture/services.yaml"
PORT="${PORT:-18080}"

cd "$DIR"
# гарантируем вход рядом с сервисом (агент читает ./services.yaml)
[ -f services.yaml ] || cp "$FIXTURE" services.yaml

echo "→ go build ./..."
go build ./... || { echo "FAIL: build"; exit 1; }

# Собираем БИНАРЬ и запускаем его напрямую (НЕ `go run .`): иначе `go run` форкает
# дочерний сервер, и kill родителя оставляет орфан, держащий порт.
BIN="$(mktemp -t bench_svc.XXXXXX)"
go build -o "$BIN" . || { echo "FAIL: build (main в корне модуля?)"; exit 1; }

echo "→ start service on :$PORT"
PORT="$PORT" "$BIN" &
SVC=$!
trap 'kill "$SVC" 2>/dev/null || true; wait "$SVC" 2>/dev/null || true; rm -f "$BIN"' EXIT

URL="http://127.0.0.1:$PORT/services?sort=platform,service"
for _ in $(seq 1 40); do
  curl -fsS "$URL" >/dev/null 2>&1 && break
  sleep 0.25
done

GOT="$(curl -fsS "$URL")" || { echo "FAIL: endpoint unreachable"; exit 1; }

# ключи объектов нормализуем (jq -S), порядок массива сохраняем — он ДОЛЖЕН быть
# отсортирован сервисом. POSIX-safe: сравниваем нормализованные строки (без process substitution).
GOT_N="$(printf '%s' "$GOT" | jq -S '.' 2>/dev/null || true)"
EXP_N="$(jq -S '.' "$EXPECTED")"
if [ -z "$GOT_N" ] || [ "$GOT_N" != "$EXP_N" ]; then
  echo "FAIL: JSON mismatch"
  echo "--- got ---";      printf '%s\n' "$GOT_N" | head -40
  echo "--- expected ---"; printf '%s\n' "$EXP_N" | head -40
  exit 1
fi
echo "✓ endpoint returns expected JSON"
# освобождаем порт перед Docker-частью
kill "$SVC" 2>/dev/null || true; wait "$SVC" 2>/dev/null || true

# 3) обязательные Docker-артефакты (компонентные тесты в изоляции)
miss=""
for f in Dockerfile docker-compose.yml run-tests.sh; do [ -f "$f" ] || miss="$miss $f"; done
if [ -n "$miss" ]; then echo "FAIL: отсутствуют Docker-артефакты:$miss"; exit 1; fi
echo "✓ Dockerfile + docker-compose.yml + run-tests.sh present"

# 4) агентские компонентные тесты в Docker (чёрный ящик)
if [ "${SKIP_DOCKER:-0}" = "1" ]; then
  echo "• SKIP_DOCKER=1 → Docker-прогон run-tests.sh пропущен"
else
  echo "→ run-tests.sh (компонентные тесты в Docker)"
  out="$(sh ./run-tests.sh 2>&1)"; rc=$?
  # ретрай 1 раз при ТРАНЗИЕНТНОМ сбое реестра/сети (не маскируем реальный провал тестов)
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -qiE 'EOF|failed to resolve|registry-1\.docker\.io|i/o timeout|TLS handshake|temporary failure|connection reset'; then
    echo "• транзиентный сбой реестра Docker — ретрай run-tests.sh"
    out="$(sh ./run-tests.sh 2>&1)"; rc=$?
  fi
  printf '%s\n' "$out" | tail -12
  [ "$rc" -eq 0 ] || { echo "FAIL: run-tests.sh exit != 0"; exit 1; }
fi
echo "PASS — all checks green"
exit 0
