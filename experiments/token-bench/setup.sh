#!/usr/bin/env sh
# Настройка стенда эксперимента — для оператора ИЛИ агента. Идемпотентно; диагностирует среду,
# собирает прокси-бинарь, готовит .env, самопроверяет стоп-линию. Запуск из корня репо:
#   sh experiments/token-bench/setup.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ok=0; warn=0; fail=0
chk(){ name="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $name"; ok=$((ok+1)); else echo "  ✗ $name"; fail=$((fail+1)); fi; }

echo "== token-bench setup =="
echo "[1] обязательные инструменты (стоп-линия + прокси + Docker-тесты)"
chk "go" go version; chk "jq" jq --version; chk "curl" curl --version; chk "docker" docker --version
if docker info >/dev/null 2>&1; then echo "  ✓ docker daemon"; ok=$((ok+1)); else echo "  ✗ docker daemon не запущен"; fail=$((fail+1)); fi

echo "[2] сборка прокси-бинаря"
if go -C "$HERE/proxy/tokenproxy" build -o "$HERE/proxy/bin/tokenproxy" . 2>/dev/null; then
  echo "  ✓ proxy/bin/tokenproxy"; ok=$((ok+1)); else echo "  ✗ сборка прокси"; fail=$((fail+1)); fi

echo "[3] .env прокси (секрет, не в гит)"
[ -f "$HERE/proxy/.env" ] && echo "  ✓ proxy/.env есть" || { cp "$HERE/proxy/.env.example" "$HERE/proxy/.env"; echo "  • создан proxy/.env — ВПИШИ ключ провайдера"; warn=$((warn+1)); }

echo "[4] раннеры экспериментальных армов"
command -v opencode >/dev/null 2>&1 && echo "  ✓ opencode" || { echo "  ✗ opencode (для armов opencode/omo)"; warn=$((warn+1)); }
command -v claude   >/dev/null 2>&1 && echo "  ✓ claude (Claude Code)" || { echo "  • claude нет (для armов plain/harness-claude)"; warn=$((warn+1)); }
opencode plugin list 2>/dev/null | grep -qi 'oh-my\|omo' && echo "  ✓ omo установлен" || { echo "  • omo нет (для арма omo)"; warn=$((warn+1)); }
[ -n "${ANTHROPIC_API_KEY:-}" ] && echo "  ✓ ANTHROPIC_API_KEY в env" || { echo "  • нет ANTHROPIC_API_KEY"; warn=$((warn+1)); }

echo "[5] самопроверка стоп-линии (endpoint + Docker-компонентный)"
cp "$HERE/fixture/services.yaml" "$HERE/acceptance/reference/services.yaml" 2>/dev/null || true
chk "check.sh на эталоне" sh "$HERE/acceptance/check.sh" "$HERE/acceptance/reference"
docker compose -f "$HERE/acceptance/reference/docker-compose.yml" down -v >/dev/null 2>&1 || true
rm -f "$HERE/acceptance/reference/services.yaml" "$HERE/acceptance/reference/svc"

echo ""
echo "итог: ok=$ok warn=$warn fail=$fail"
[ "$fail" -gt 0 ] && { echo "✗ критичные пробелы (go/jq/curl/docker/прокси) — стенд НЕ готов."; exit 1; }
echo "Стенд готов. Прогон арма — см. RUNBOOK.md."
exit 0
