#!/usr/bin/env sh
# Инвентаризация поставки харнеса: СКОЛЬКО и КАКИХ тестов он написал. Печатает JSON.
# Используется bench.sh после каждого прогона — это ядро сравнения «как справился харнес».
set -eu
DIR="${1:?usage: inventory.sh <service_dir>}"
cd "$DIR"

cnt() { printf '%s' "$1" | grep -c . 2>/dev/null || echo 0; }
go_test_files=$(find . -name '*_test.go' 2>/dev/null | wc -l | tr -d ' ')
go_test_funcs=$(grep -rhoE '^func Test[A-Za-z0-9_]+' --include='*_test.go' . 2>/dev/null | wc -l | tr -d ' ')
subtests=$(grep -rhoE 't\.Run\(' --include='*_test.go' . 2>/dev/null | wc -l | tr -d ' ')
feature_files=$(find . -name '*.feature' 2>/dev/null | wc -l | tr -d ' ')
scenarios=$(grep -rhiE '^[[:space:]]*(Scenario|Сценарий)' --include='*.feature' . 2>/dev/null | wc -l | tr -d ' ')
compose_file=$(find . \( -iname 'docker-compose*.y*ml' -o -iname '*compose*.y*ml' \) 2>/dev/null | head -1)
compose_services=0
[ -n "$compose_file" ] && compose_services=$(grep -cE '^[[:space:]]{2}[a-z][a-z0-9_-]*:[[:space:]]*$' "$compose_file" 2>/dev/null || echo 0)
test_loc=$(find . \( -name '*_test.go' -o -name '*.feature' \) 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1+0}')
has_dockerfile=$([ -n "$(find . -iname 'Dockerfile*' 2>/dev/null)" ] && echo true || echo false)
has_compose=$([ -n "$compose_file" ] && echo true || echo false)
has_runtests=$([ -n "$(find . -iname 'run-tests*.sh' 2>/dev/null)" ] && echo true || echo false)

printf '{"go_test_files":%s,"go_test_funcs":%s,"subtests":%s,"feature_files":%s,"scenarios":%s,"compose_services":%s,"test_loc":%s,"has_dockerfile":%s,"has_compose":%s,"has_runtests":%s}\n' \
  "${go_test_files:-0}" "${go_test_funcs:-0}" "${subtests:-0}" "${feature_files:-0}" "${scenarios:-0}" "${compose_services:-0}" "${test_loc:-0}" "$has_dockerfile" "$has_compose" "$has_runtests"
