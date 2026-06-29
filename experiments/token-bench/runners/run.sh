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
L="${TIER_LARGE:-anthropic/claude-opus-4-8}"; M="${TIER_MEDIUM:-anthropic/claude-sonnet-4-6}"; S="${TIER_SMALL:-anthropic/claude-haiku-4-5}"
MAX="${MAX_SECONDS:-1800}"; SES="${SES:-bench-$ARM}"
command -v tmux >/dev/null || { echo "нужен tmux"; exit 1; }

sh "$HERE/reset.sh" "$SB" >/dev/null   # чистый go-модуль + services.yaml + TASK.md

if [ "$ARM" = opencode ]; then
  # харнес rationaldev для OpenCode + enforcement-адаптер (guardrail)
  ( cd "$BUNDLE" && sh install.sh opencode "$SB" --hard >/dev/null )
  inject() { f="$SB/.opencode/agent/$1.md"; [ -f "$f" ] || return 0; s="$(readlink "$f" 2>/dev/null || echo "$f")"
    awk -v m="$2" 'NR==1&&/^---/{print; print "model: " m; next}1' "$s" > "$f.t"; rm -f "$f"; mv "$f.t" "$f"; }
  # 6 ролей rationaldev по тирам
  inject orchestrator "$L"; inject planner "$L"; inject plan-reviewer "$L"
  inject implementer "$S"; inject fixer "$L"; inject release-health "$M"
  AGENTFLAG="--agent orchestrator"
  # авто-аппрув Gate #1 (плагин блокирует @implementer)
  ( i=0; while [ "$i" -lt "$MAX" ]; do [ -f "$SB/.agent/plan-reviewer/plan-review.md" ] && { mkdir -p "$SB/.agent/gates"; touch "$SB/.agent/gates/gate1.approved"; break; }; i=$((i+1)); sleep 2; done ) &
else
  AGENTFLAG=""   # omo: глобальный плагин, дефолтный агент
fi

tmux kill-session -t "$SES" 2>/dev/null || true
tmux new-session -d -s "$SES" -x 210 -y 52 -c "$SB"
tmux send-keys -t "$SES" "export ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY:-}'${XDG_CONFIG_HOME:+ XDG_CONFIG_HOME='$XDG_CONFIG_HOME'}; opencode $AGENTFLAG" Enter
sleep 12
PROMPT='Read ./TASK.md in the CURRENT directory and implement it fully HERE per its requirements (modular service with internal/ packages, OpenAPI in api-specification/, config from file/env no hardcode, Gherkin component tests in Docker via godog, unit tests, README with failure-mode map). Do not search outside. Done = sh ./run-tests.sh exits 0. Start now.'
tmux send-keys -t "$SES" -l "$PROMPT"; tmux send-keys -t "$SES" Enter

# наблюдение + авто-allow permission-промптов
t=0
while [ "$t" -lt "$MAX" ]; do
  tmux capture-pane -t "$SES" -p > "$SB/tmux.log" 2>/dev/null || break
  grep -qi 'Permission required\|Allow once' "$SB/tmux.log" && tmux send-keys -t "$SES" Enter
  t=$((t+5)); sleep 5
done
echo "арм $ARM завершён (лог: $SB/tmux.log; attach: tmux attach -t $SES)"
