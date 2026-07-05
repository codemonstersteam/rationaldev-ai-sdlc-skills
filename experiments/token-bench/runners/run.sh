#!/usr/bin/env sh
# Наблюдаемый прогон арма эксперимента через tmux (send-keys + capture-pane).
# Usage: run.sh <arm> <sandbox>        arm ∈ { opencode | omo }
#   opencode — харнес rationaldev на OpenCode (install.sh opencode <sb> --hard), 3 тира по ролям
#   omo      — глобально установленный oh-my-openagent (без харнеса)
# Предусловия (см. RUNBOOK.md): поднят прокси (proxy/run-proxy.sh), OpenCode настроен на прокси
#   (XDG-конфиг с provider.anthropic.options.baseURL=http://localhost:4000/v1), ключ в env.
# Лог экрана: <sandbox>/tmux.log. Требует tmux.
set -eu
ARM="${1:?usage: run.sh <opencode|omo> <sandbox>}"
SB="${2:?usage: run.sh <arm> <sandbox>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$(cd "$HERE/../../.." && pwd)"   # корень репо rationaldev
# Модели по тирам — из конфига харнеса (harness/models.config.json opencode-секция), НЕ хардкод.
# env TIER_* переопределяет; пусто в конфиге → падаем с явной ошибкой (модель не задана).
CFG="$BUNDLE/harness/models.config.json"
L="${TIER_LARGE:-$(jq -r '.opencode.tiers.large // ""' "$CFG")}"
M="${TIER_MEDIUM:-$(jq -r '.opencode.tiers.medium // ""' "$CFG")}"
S="${TIER_SMALL:-$(jq -r '.opencode.tiers.small // ""' "$CFG")}"
[ -n "$L" ] && [ -n "$M" ] && [ -n "$S" ] || { echo "модели не заданы в $CFG (opencode.tiers)"; exit 1; }
echo "модели по тирам: large=$L medium=$M small=$S"
MAX="${MAX_SECONDS:-7200}"; SES="${SES:-bench-$ARM}"
command -v tmux >/dev/null || { echo "нужен tmux"; exit 1; }

sh "$HERE/reset.sh" "$SB" >/dev/null   # чистый go-модуль + services.yaml + TASK.md

if [ "$ARM" = opencode ]; then
  # харнес rationaldev (v2 flat) для OpenCode + enforcement-адаптер (guardrail).
  # Модели проставляет gen-agents по тирам из harness/models.config.json при install — НЕ инжектим
  # (роли orchestrator/planner/… в v2 не существуют; вход — primary-роль izi).
  ( cd "$BUNDLE" && sh install.sh opencode "$SB" --hard >/dev/null )
  AGENTFLAG="--agent izi"
  # Gate #1: по умолчанию ПАУЗА для ревью — guardrail держит имплементера до gate1.approved,
  # который ставит ОПЕРАТОР. AUTO_GATE1=1 → авто-аппрув (hands-off, старый флоу).
  if [ "${AUTO_GATE1:-}" = 1 ]; then
    ( i=0; while [ "$i" -lt "$MAX" ]; do [ -f "$SB/.agent/plan-reviewer/plan-review.md" ] && { mkdir -p "$SB/.agent/gates"; touch "$SB/.agent/gates/gate1.approved"; break; }; i=$((i+1)); sleep 2; done ) &
  fi
else
  AGENTFLAG=""   # omo: глобальный плагин, дефолтный агент
fi

tmux kill-session -t "$SES" 2>/dev/null || true
tmux new-session -d -s "$SES" -x 210 -y 52 -c "$SB"
tmux send-keys -t "$SES" "export ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY:-}'${XDG_CONFIG_HOME:+ XDG_CONFIG_HOME='$XDG_CONFIG_HOME'}; opencode $AGENTFLAG" Enter
sleep 12
PROMPT='Прочитай ./TASK.md в текущей директории и веди задачу до конца здесь. Не ищи снаружи. Готово = sh ./run-tests.sh даёт exit 0.'
tmux send-keys -t "$SES" -l "$PROMPT"; tmux send-keys -t "$SES" Enter

# наблюдение + авто-allow permission-промптов
t=0
while [ "$t" -lt "$MAX" ]; do
  tmux capture-pane -t "$SES" -p > "$SB/tmux.log" 2>/dev/null || break
  grep -qi 'Permission required\|Allow once' "$SB/tmux.log" && tmux send-keys -t "$SES" Enter
  t=$((t+5)); sleep 5
done
echo "арм $ARM завершён (лог: $SB/tmux.log; attach: tmux attach -t $SES)"
