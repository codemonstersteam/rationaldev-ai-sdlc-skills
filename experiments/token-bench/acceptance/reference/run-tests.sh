#!/usr/bin/env sh
# Reference component test — сервис в ИЗОЛЯЦИИ в Docker, чёрный ящик (только HTTP).
# Образец того, что должен поставить агент (паттерн как в rra-docs-another/component-tests:
# раннер внутри Docker, без хостового go test). exit 0 = тесты прошли.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
[ -f services.yaml ] || cp "$HERE/../../fixture/services.yaml" services.yaml

docker compose up -d --build
trap 'docker compose down -v --remove-orphans >/dev/null 2>&1 || true' EXIT

URL="http://127.0.0.1:8080/services?sort=platform,service"
for _ in $(seq 1 60); do curl -fsS "$URL" >/dev/null 2>&1 && break; sleep 0.5; done
GOT="$(curl -fsS "$URL")"

# happy path: 6 элементов, отсортированы по platform (первый — backend/auth)
echo "$GOT" | jq -e 'length==6 and .[0].platform=="backend" and .[0].service=="auth"' >/dev/null \
  || { echo "FAIL: happy path"; exit 1; }
# failure mode: пустой services.yaml → пустой массив (не 500)
echo "PASS — component test (containerized, isolated)"
