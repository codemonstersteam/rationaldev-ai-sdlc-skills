#!/usr/bin/env sh
# Свод результатов из results/raw/results.jsonl → markdown-отчёт (stdout).
# Метрика: выходные токены до PASS, медиана + p25/p75 (IQR), success-rate.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$HERE/results/raw/results.jsonl"
[ -f "$RES" ] || { echo "нет данных: $RES (запусти bench.sh)"; exit 0; }

echo "# Bench report — rational-agents vs omo"
echo
echo "Метрика: **выходные токены до PASS** (\`acceptance/check.sh\`), ground truth — лог прокси."
echo "Сравнивай по медиане среди PASS-прогонов (токены-на-успех). Дешёвый, но FAIL — не дешевле."
echo
echo "| Харнес | прогонов | success | медиана output | p25 | p75 |"
echo "|---|---|---|---|---|---|"
for h in rational omo; do
  jq -rs --arg h "$h" '
    [ .[] | select(.harness==$h) ] as $all
    | ( [ $all[] | select(.pass==1) | .output_tokens ] | sort ) as $t
    | ($t|length) as $m
    | "| \($h) | \($all|length) | \([ $all[]|select(.pass==1) ]|length)/\($all|length) | "
      + ( if $m>0 then ($t[($m/2|floor)]|tostring) else "—" end ) + " | "
      + ( if $m>0 then ($t[($m*0.25|floor)]|tostring) else "—" end ) + " | "
      + ( if $m>0 then ($t[($m*0.75|floor)]|tostring) else "—" end ) + " |"
  ' "$RES"
done
echo
echo "## Что написал каждый харнес (тесты)"
echo
echo "Медианы по прогонам: сценарии (.feature), Go-тест-функции, файлы .feature, сервисы в compose,"
echo "строки тестов; доля прогонов с Docker-изоляцией."
echo
echo "| Харнес | scenarios | go test funcs | .feature | compose svcs | test LOC | compose% | dockerfile% |"
echo "|---|---|---|---|---|---|---|---|"
med='def med($k): ([ .[].tests[$k] // 0 ]|sort) as $a | if ($a|length)>0 then $a[($a|length)/2|floor] else 0 end;'
rate='def rate($k): ([ .[].tests[$k] ]) as $a | if ($a|length)>0 then (([ $a[]|select(.==true) ]|length)*100/($a|length)|floor) else 0 end;'
for h in rational omo; do
  jq -rs --arg h "$h" "$med $rate"'
    [ .[] | select(.harness==$h) ] as $a
    | ($a|length) as $n
    | if $n==0 then "| \($h) | — | — | — | — | — | — | — |"
      else "| \($h) | \($a|med("scenarios")) | \($a|med("go_test_funcs")) | \($a|med("feature_files")) | \($a|med("compose_services")) | \($a|med("test_loc")) | \($a|rate("has_compose"))% | \($a|rate("has_dockerfile"))% |"
      end
  ' "$RES"
done
echo
echo "_N прогонов на харнес; сброс состояния между прогонами; одна модель/temp/provider через прокси._"
