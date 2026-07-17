#!/usr/bin/env sh
# Готовит ЭТАЛОННУЮ песочницу для ручного прогона харнеса rationaldev на OpenCode
# через OpenRouter (GLM 5.2 / Qwen3.6-27b) за token-bench прокси. Идемпотентно —
# запускай сколько угодно, каждый раз пересобирает чистую песочницу и конфиг.
#
# Usage: prepare-rational-sandbox.sh [sandbox-dir]   (по умолчанию ../test-harnes-rational)
#
# Что делает:
#   1) ставит харнес в песочницу (install.sh opencode --no-input; модели — из
#      harness/models.config.json opencode-секции: large=GLM 5.2, medium/small=Qwen3.6-27b);
#   2) кладёт TASK.md (bench spec/task.md);
#   3) пишет ПРОЕКТНО-ЛОКАЛЬНЫЙ конфиг прогона $SB/opencode.jsonc (провайдер openrouter →
#      прокси). Глобальный ~/.config/opencode НЕ трогается вовсе.
#   4) поднимает token-логирующий прокси на :4000, если не запущен.
#
# ПРО omo (oh-my-openagent): конфиг прогона — проектный, но opencode МЕРЖИТ global+project
# и проектный НЕ может отключить плагин, объявленный в global (массивы плагинов
# конкатенируются, disable-механизма нет). Поэтому omo должен жить ПРОЕКТНО (в своих
# проектах: opencode.json {"plugin":["oh-my-openagent"]} + .opencode/oh-my-openagent.json —
# образец omo-sdlc-test/opencode.json), а НЕ в global. Иначе его sisyphus/opus протечёт
# в песочницу и перехватит прогон. Шаг 2a проверяет global и предупреждает.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
BENCH="$(cd "$HERE/.." && pwd)"                 # experiments/token-bench
BUNDLE="$(cd "$BENCH/../.." && pwd)"            # корень репо rationaldev
SB="${1:-$BUNDLE/../test-harnes-rational}"

KEY="$(grep -h OPENROUTER_API_KEY "$BENCH/proxy/.env" 2>/dev/null | cut -d= -f2 || true)"
[ -n "$KEY" ] || { echo "нет OPENROUTER_API_KEY в $BENCH/proxy/.env (скопируй proxy/.env.example)"; exit 1; }
command -v jq >/dev/null || { echo "нужен jq"; exit 1; }

# 1) песочница + харнес (--hard: guardrail-плагин форсит Gate #1 + decisions.log)
rm -rf "$SB"; mkdir -p "$SB"
sh "$BUNDLE/install.sh" opencode "$SB" --no-input --hard
cp "$BENCH/spec/task.md" "$SB/TASK.md"

# 2) ПРОЕКТНО-ЛОКАЛЬНЫЙ конфиг прогона (в песочнице, НЕ глобальный).
# ЕДИНЫЙ источник — harness/models.config.json: дефолт-модель (tiers.large) + watchdog.chunkTimeout.
MODELS="$BUNDLE/harness/models.config.json"
MODEL="$(jq -r '.opencode.tiers.large // "openrouter/z-ai/glm-5.2"' "$MODELS")"
CHUNK="$(jq -r '.watchdog.chunkTimeout // 90000' "$MODELS")"
cat > "$SB/opencode.jsonc" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "$MODEL",
  "provider": { "openrouter": { "options": {
    "baseURL": "http://localhost:4000/api/v1", "apiKey": "$KEY", "chunkTimeout": $CHUNK } } }
}
JSON

# 2a) Гард: opencode мержит global+project; проектный конфиг НЕ отключает плагин из global.
#     Если global объявляет omo-плагин — он протечёт в песочницу (sisyphus/opus перехватят).
OMO_LEAK=0; LEAK_AT=""
# opencode грузит плагины из opencode.json[c]; tui.json проверяем на всякий (omo-инсталлер
# исторически писал туда plugin-ключ — инертный, но пусть гард видит любой omo-след в global).
for GCFG in "$HOME/.config/opencode/opencode.jsonc" "$HOME/.config/opencode/opencode.json" \
            "$HOME/.config/opencode/tui.json"; do
  [ -f "$GCFG" ] || continue
  if grep -Eq '"plugin"|oh-my-openagent' "$GCFG"; then OMO_LEAK=1; LEAK_AT="$GCFG"; fi
done
if [ "$OMO_LEAK" = 1 ]; then
  cat >&2 <<WARN

⚠️  ВНИМАНИЕ: глобальный $LEAK_AT объявляет "plugin" (вероятно omo).
    opencode мержит global+project → плагин ПРОТЕЧЁТ в песочницу и перехватит прогон
    (проектный конфиг отключить его НЕ может). Сделай omo проектно-локальным:
      • убери "plugin" из global ($LEAK_AT);
      • в omo-проект положи opencode.json {"plugin":["oh-my-openagent"]}
        + .opencode/oh-my-openagent.json  (образец: omo-sdlc-test/opencode.json).
    Прогон харнеса продолжать НЕ рекомендуется, пока global объявляет плагин.

WARN
fi

# 3) прокси токенов (если не поднят)
if ! curl -s -o /dev/null http://localhost:4000/ 2>/dev/null; then
  command -v tmux >/dev/null && tmux new-session -d -s bench-proxy -c "$BENCH/proxy" \
    "sh run-proxy.sh 2>&1 | tee proxy.tmux.log" 2>/dev/null || sh "$BENCH/proxy/run-proxy.sh" &
  sleep 2
fi

cat <<EOF

✅ Эталонная песочница готова: $SB
   Модели: large=GLM 5.2 · medium/small=Qwen3.6-27b  (harness/models.config.json)
   Конфиг прогона: $SB/opencode.jsonc (ПРОЕКТНО-ЛОКАЛЬНЫЙ) · прокси :4000 → OpenRouter
   Глобальный ~/.config/opencode НЕ тронут. omo подключается ПРОЕКТНО (не в global) —
   иначе его sisyphus/opus перехватит прогон (см. гард выше).

Запуск харнеса:
  cd "$SB"
  export OPENROUTER_API_KEY=$KEY
  opencode --agent izi     # затем: прочитай ./TASK.md и реализуй

Апрув Gate #1 (guardrail жёстко блокирует @implementer до этого; агент маркер не поставит):
  touch "$SB/.agent/gates/gate1.approved"     # ← ставит ОПЕРАТОР, когда принял план

Модель по факту (в другом терминале):
  tail -f "$BENCH/proxy/usage.jsonl" | jq -c '{req_model,input_tokens,completion_tokens}'
EOF
