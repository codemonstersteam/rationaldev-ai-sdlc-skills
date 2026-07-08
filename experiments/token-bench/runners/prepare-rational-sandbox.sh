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
#   3) правит глобальный ~/.config/opencode/opencode.jsonc: провайдер openrouter → прокси,
#      БЕЗ плагина omo (иначе его агент sisyphus/opus перехватывает запуск) — с бэкапом;
#   4) поднимает token-логирующий прокси на :4000, если не запущен.
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

# 2) глобальный opencode: openrouter → прокси, без omo
CFG="$HOME/.config/opencode/opencode.jsonc"
mkdir -p "$(dirname "$CFG")"
[ -f "$CFG" ] && [ ! -f "$CFG.bak-before-rational-test" ] && cp "$CFG" "$CFG.bak-before-rational-test" || true
# ЕДИНЫЙ источник — harness/models.config.json: дефолт-модель (tiers.large) + watchdog.chunkTimeout.
MODELS="$BUNDLE/harness/models.config.json"
MODEL="$(jq -r '.opencode.tiers.large // "openrouter/z-ai/glm-5.2"' "$MODELS")"
CHUNK="$(jq -r '.watchdog.chunkTimeout // 90000' "$MODELS")"
cat > "$CFG" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "$MODEL",
  "provider": { "openrouter": { "options": {
    "baseURL": "http://localhost:4000/api/v1", "apiKey": "$KEY", "chunkTimeout": $CHUNK } } }
}
JSON

# 3) прокси токенов (если не поднят)
if ! curl -s -o /dev/null http://localhost:4000/ 2>/dev/null; then
  command -v tmux >/dev/null && tmux new-session -d -s bench-proxy -c "$BENCH/proxy" \
    "sh run-proxy.sh 2>&1 | tee proxy.tmux.log" 2>/dev/null || sh "$BENCH/proxy/run-proxy.sh" &
  sleep 2
fi

cat <<EOF

✅ Эталонная песочница готова: $SB
   Модели: large=GLM 5.2 · medium/small=Qwen3.6-27b  (harness/models.config.json)
   omo отключён (бэкап: $CFG.bak-before-rational-test) · прокси :4000 → OpenRouter

Запуск харнеса:
  cd "$SB"
  export OPENROUTER_API_KEY=$KEY
  opencode --agent izi     # затем: прочитай ./TASK.md и реализуй

Апрув Gate #1 (guardrail жёстко блокирует @implementer до этого; агент маркер не поставит):
  touch "$SB/.agent/gates/gate1.approved"     # ← ставит ОПЕРАТОР, когда принял план

Модель по факту (в другом терминале):
  tail -f "$BENCH/proxy/usage.jsonl" | jq -c '{req_model,input_tokens,completion_tokens}'

Вернуть omo обратно:
  cp "$CFG.bak-before-rational-test" "$CFG"
EOF
