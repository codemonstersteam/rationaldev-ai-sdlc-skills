#!/usr/bin/env sh
# watch-izi-resume.sh — сторож живого прогона харнеса (OpenCode + OpenRouter).
#
# Проблема: провайдер (OpenRouter → апстрим) изредка отдаёт `504 Upstream idle timeout` —
# стрим роутера izi (GLM-4.7-flash) падает, ход izi завершается ошибкой, izi простаивает,
# прогон встаёт. Раньше лечили ручным нуджем в tmux.
#
# Что делает сторож: следит за `opencode.log`; на СВЕЖИЙ провайдерский stream-error спит минуту
# (даёт апстриму оклематься) и будит izi ОДНИМ нуджем — izi по durable-progress перечитывает
# .agent/planner + decisions.log и продолжает с текущего места, НЕ переделывая готовое (T04).
#
# БЕЗОПАСНОСТЬ (почему это не ломает человек-гейты):
#   • Триггер — ТОЛЬКО строка `level=ERROR ... stream error/timeout/upstream idle` в логе.
#   • Gate #1 (акцепт плана) и permission-промпты ошибок в лог НЕ пишут → сторож на них не реагирует.
#   • Доп-страховка: если в момент срабатывания на экране виден permission/confirm-промпт — НЕ нуджим.
#   • Антидребезг (COOLDOWN) — не нуджим чаще, чем раз в 90с.
# Итог: сторож умеет только «оживить после сбоя провайдера», но не может акцептовать гейт за оператора.
#
# Usage: watch-izi-resume.sh [tmux-session] [opencode-log]
#   по умолчанию: bench-rational  ~/.local/share/opencode/log/opencode.log
# Останов: tmux kill-session -t bench-watch  (если запущен там), или Ctrl-C.
set -eu

SESSION="${1:-bench-rational}"
LOG="${2:-$HOME/.local/share/opencode/log/opencode.log}"
COOLDOWN=90   # мин. секунд между нуджами (антидребезг burst-ошибок)
SETTLE=60     # спим столько после ошибки, прежде чем будить (апстрим оклемается)
POLL=5        # период опроса лога, сек
# КОРОТКИЙ однострочный нудж — длинный/переносящийся в TUI не сабмитится (встаёт QUEUED).
NUDGE="Провайдер оборвался — продолжи с текущего места, не переделывай"

lines() { wc -l < "$LOG" 2>/dev/null || echo 0; }

last_nudge=0
pos="$(lines)"   # стартуем с КОНЦА лога — старые ошибки игнорируем
echo "[watch] $(date -u +%H:%M:%SZ) сторож izi запущен · сессия=$SESSION · лог=$LOG (с строки $pos)"

while true; do
  sleep "$POLL"
  now="$(lines)"
  [ "$now" -le "$pos" ] && continue
  new="$(sed -n "$((pos + 1)),${now}p" "$LOG" 2>/dev/null || true)"
  pos="$now"

  echo "$new" | grep -qiE 'level=ERROR.*(stream error|timeout|upstream idle|"code":50)' || continue

  ts="$(date +%s)"
  [ $((ts - last_nudge)) -lt "$COOLDOWN" ] && { echo "[watch] ошибка, но cooldown → пропуск"; continue; }

  # не трогаем, если ждёт ЧЕЛОВЕКА (permission/confirm-промпт на экране)
  if tmux capture-pane -t "$SESSION" -p 2>/dev/null | grep -qE 'Allow (once|always)|Confirm +Cancel'; then
    echo "[watch] $(date -u +%H:%M:%SZ) ошибка есть, но виден permission-промпт → НЕ нуджу (за оператором)"
    continue
  fi

  echo "[watch] $(date -u +%H:%M:%SZ) провайдерский stream-error — сплю ${SETTLE}s, потом бужу izi"
  sleep "$SETTLE"
  # пред-очистка инпута (сбросить залипший/частичный ввод) — иначе нудж конкатенируется/встаёт QUEUED
  tmux send-keys -t "$SESSION" Escape 2>/dev/null || { echo "[watch] нет сессии $SESSION — стоп"; exit 0; }
  tmux send-keys -t "$SESSION" C-u 2>/dev/null || true
  sleep 1
  tmux send-keys -t "$SESSION" "$NUDGE" 2>/dev/null
  sleep 1
  tmux send-keys -t "$SESSION" Enter 2>/dev/null || true
  last_nudge="$(date +%s)"
  echo "[watch] $(date -u +%H:%M:%SZ) izi разбужен"
done
