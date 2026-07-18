#!/usr/bin/env sh
# Подключает харнес rationaldev к выбранному раннеру (симлинки).
#
#   ./install.sh <claude|codex|opencode> [--global | <project-dir>] [--hard] [--no-input]
#
#   ./install.sh opencode --global         # глобально для всех проектов
#   ./install.sh claude ~/myproject        # в конкретный проект
#   ./install.sh codex                     # в текущую директорию
#   ./install.sh opencode . --hard         # + enforcement-адаптер (Slice 6)
#   ./install.sh claude . --no-input       # без интерактива (модели — из конфига как есть)
#
# Идемпотентно (ln -sfn). Источник правды: skills/lib + harness/agents.
# При установке интерактивно спрашивает 3 модели (large/medium/small) → пишет
# harness/models.config.json и перегенерирует проекции. Подробно — harness/README.md.
set -eu

BUNDLE="$(cd "$(dirname "$0")" && pwd)"
LIB="$BUNDLE/skills/lib"

RUNNER="${1:-}"
[ -n "$RUNNER" ] || { echo "usage: ./install.sh <claude|codex|opencode> [--global | <dir>] [--soft] [--no-input]  (enforcement вкл по умолчанию; --soft отключает)"; exit 1; }
shift

SCOPE="project"; PROJ="$(pwd)"; HARD="yes"; NOINPUT="no"   # enforcement ВСЕГДА вкл по умолчанию (--soft отключает)
for arg in "$@"; do
  case "$arg" in
    --global)   SCOPE="global" ;;
    --hard)     HARD="yes" ;;
    --soft)     HARD="no" ;;
    --no-input) NOINPUT="yes" ;;
    *)          PROJ="$arg" ;;
  esac
done

# --- модели: интерактивная настройка тиров + перегенерация проекций ---
# configure-models сам молчит, если stdin не TTY (CI/пайп). gen-agents идемпотентен.
if command -v node >/dev/null 2>&1; then
  [ "$NOINPUT" = yes ] || node "$BUNDLE/harness/configure-models.mjs" "$RUNNER" || true
  node "$BUNDLE/harness/gen-agents.mjs" >/dev/null 2>&1 || true
else
  echo "  ⚠ node не найден — модели/проекции не обновлены (правь harness/models.config.json, затем node harness/gen-agents.mjs)"
fi

# --- хелперы ---
# Линкуем КАТАЛОГИ, не файлы (self-update T2): dst = симлинк на каталог-источник в бандле.
# Тогда `git pull` в бандле = мгновенное обновление проекта, ВКЛЮЧАЯ новые файлы (роли/валидаторы/
# конфиги) — ноль переустановок. Старый пофайловый install оставлял реальный каталог → сносим его.
link_dir() {  # $1 = каталог-источник (бандл), $2 = путь-назначения (симлинк)
  src="$1"; dst="$2"
  # ЗАЩИТА: install в сам бандл (src и dst — один физический путь) → НИЧЕГО не делаем (иначе rm -rf снёс бы
  # реальный harness/ и создал висячий self-симлинк). Сравниваем по realpath; несуществующий dst → не равен.
  rp="$(cd "$dst" 2>/dev/null && pwd -P || true)"
  [ -n "$rp" ] && [ "$rp" = "$(cd "$src" 2>/dev/null && pwd -P || true)" ] && return 0
  mkdir -p "$(dirname "$dst")"
  [ -L "$dst" ] && rm -f "$dst"          # старый симлинк — переcreateем
  [ -d "$dst" ] && rm -rf "$dst"         # старый РЕАЛЬНЫЙ каталог (пофайловый install) — сносим
  ln -sfn "$src" "$dst"
}
link_dir_skills() { link_dir "$LIB" "$1"; }                 # $LIB=skills/lib (только <name>/SKILL.md, без flat)
link_agents() { link_dir "$2" "$1"; }                       # $1=dst, $2=src каталог проекций (сигнатура сохранена)
count() { ls "$1" 2>/dev/null | wc -l | tr -d ' '; }
place_instruction() {  # $1 = источник, $2 = путь назначения; не затирает существующий
  src="$1"; dst="$2"; mkdir -p "$(dirname "$dst")"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    alt="$(dirname "$dst")/$(basename "${dst%.md}").harness.md"
    cp "$src" "$alt"
    INSTR_NOTE="существующий $(basename "$dst") НЕ тронут → $(basename "$alt") (подключи вручную)"
  else
    ln -sfn "$src" "$dst"
    INSTR_NOTE="$dst"
  fi
}

# --- раскладка по раннеру ---
case "$RUNNER" in
  claude)
    [ "$SCOPE" = global ] && BASE="$HOME/.claude" || BASE="$PROJ/.claude"
    link_agents "$BASE/agents" "$BUNDLE/harness/agents/claude"
    link_dir_skills "$BASE/skills"
    AGENTS_DST="$BASE/agents"; SKILLS_DST="$BASE/skills"
    INSTR_SRC="$BUNDLE/harness/instructions/CLAUDE.md"
    [ "$SCOPE" = global ] && INSTR_DST="$HOME/.claude/CLAUDE.md" || INSTR_DST="$PROJ/CLAUDE.md"
    ;;
  opencode)
    [ "$SCOPE" = global ] && BASE="${XDG_CONFIG_HOME:-$HOME/.config}/opencode" || BASE="$PROJ/.opencode"
    link_agents "$BASE/agent" "$BUNDLE/harness/agents/opencode"
    link_dir_skills "$BASE/skills"
    AGENTS_DST="$BASE/agent"; SKILLS_DST="$BASE/skills"
    INSTR_SRC="$BUNDLE/harness/instructions/AGENTS.opencode.md"
    [ "$SCOPE" = global ] && INSTR_DST="$BASE/AGENTS.md" || INSTR_DST="$PROJ/AGENTS.md"
    ;;
  codex)
    # У Codex нет файлового формата субагентов: скиллы → .agents/skills,
    # роли стейджатся в .agents/roles (сборка в AGENTS.md — Slice 3).
    if [ "$SCOPE" = global ]; then SK="$HOME/.agents/skills"; RL="$HOME/.agents/roles"; else SK="$PROJ/.agents/skills"; RL="$PROJ/.agents/roles"; fi
    link_agents "$RL" "$BUNDLE/harness/agents/codex"
    link_dir_skills "$SK"
    AGENTS_DST="$RL"; SKILLS_DST="$SK"
    INSTR_SRC="$BUNDLE/harness/instructions/AGENTS.codex.md"
    [ "$SCOPE" = global ] && INSTR_DST="$HOME/.codex/AGENTS.md" || INSTR_DST="$PROJ/AGENTS.md"
    ;;
  *) echo "unknown runner: $RUNNER (claude|codex|opencode)"; exit 1 ;;
esac

# --- валидаторы/конфиги харнеса в проект (T2: dir-symlink на ВЕСЬ harness/) ---
# Роли (wirth-slicer/moduledesigner) и mills зовут `node harness/validate-*.mjs` из cwd проекта; роли
# читают harness/{target-profiles,vcs-providers}.json. Один dir-symlink `$PROJ/harness → $BUNDLE/harness`
# отдаёт всё и — главное — НОВЫЕ файлы (валидаторы/конфиги) прилетают с `git pull` без переустановки
# (баг 18-07 «vcs-providers не долетел» этим и закрыт). Только project-scope (нужен cwd проекта).
if [ "$SCOPE" != global ]; then
  link_dir "$BUNDLE/harness" "$PROJ/harness"
fi

place_instruction "$INSTR_SRC" "$INSTR_DST"

# --- enforcement (--hard) ---
HARDMSG="off (enforcement инструкцией)"
if [ "$HARD" = yes ]; then
  ADAPTER="$BUNDLE/harness/enforcement/$RUNNER"
  case "$RUNNER" in
    opencode)
      [ "$SCOPE" = global ] && pdir="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins" || pdir="$PROJ/.opencode/plugins"
      mkdir -p "$pdir"
      ln -sfn "$ADAPTER/rational-guardrail.ts" "$pdir/rational-guardrail.ts"
      # общая enforcement-логика (../shared.mjs, plugin импортит её) — рядом, чтобы резолвилась и при location-based загрузке
      ln -sfn "$BUNDLE/harness/enforcement/shared.mjs" "$(dirname "$pdir")/shared.mjs"
      # watchdog-настройки плагина (T09b nudge/cooldown) из ЕДИНОГО источника models.config.json → рядом с плагином
      command -v jq >/dev/null 2>&1 && jq '.watchdog // {}' "$BUNDLE/harness/models.config.json" > "$(dirname "$pdir")/rational.config.json" 2>/dev/null || true
      HARDMSG="on → OpenCode-плагин ($pdir/rational-guardrail.ts) + watchdog-конфиг"
      ;;
    claude)
      [ "$SCOPE" = global ] && cbase="$HOME/.claude" || cbase="$PROJ/.claude"
      mkdir -p "$cbase/hooks"
      ln -sfn "$ADAPTER/gate-check.mjs"   "$cbase/hooks/gate-check.mjs"
      ln -sfn "$ADAPTER/gate-bash.mjs"    "$cbase/hooks/gate-bash.mjs"
      ln -sfn "$ADAPTER/gate-approve.mjs" "$cbase/hooks/gate-approve.mjs"
      ln -sfn "$ADAPTER/log-decision.mjs" "$cbase/hooks/log-decision.mjs"
      # общая enforcement-логика (../shared.mjs, хуки импортят её) — рядом на случай location-based резолва
      ln -sfn "$BUNDLE/harness/enforcement/shared.mjs" "$cbase/shared.mjs"
      # JSON-строки: кавычки вокруг пути ДОЛЖНЫ быть экранированы (\") — иначе settings.json битый
      gc="node \\\"$cbase/hooks/gate-check.mjs\\\""; gb="node \\\"$cbase/hooks/gate-bash.mjs\\\""; ga="node \\\"$cbase/hooks/gate-approve.mjs\\\""; ld="node \\\"$cbase/hooks/log-decision.mjs\\\""
      # Авто-апдейт ОТКЛЮЧЁН — SessionStart-триггера нет (только ручной `rationaldev update`).
      # permissions: ПОЛНЫЙ доступ субагентам, пока работают (defaultMode bypassPermissions — без промптов
      # ни на bash, ни на правки: столл-на-промпте убивает автономный прогон). allow-лист оставлен как
      # безопасная деградация, если режим позже понизят. Хуки (PreToolUse) имеют ПРИОРИТЕТ и работают
      # НЕЗАВИСИМО от режима прав: gate-check/gate-bash exit 2 держат фронтдор/Gate #1/poka-yoke даже здесь.
      sjson='{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": [
      "Bash(go *)", "Bash(gofmt *)", "Bash(node *)", "Bash(sh *)", "Bash(bash *)",
      "Bash(docker *)", "Bash(docker compose *)", "Bash(git *)", "Bash(perl *)", "Bash(tar *)", "Bash(curl *)",
      "Bash(jq *)", "Bash(grep *)", "Bash(rg *)", "Bash(cat *)", "Bash(ls *)", "Bash(find *)", "Bash(head *)",
      "Bash(tail *)", "Bash(wc *)", "Bash(sort *)", "Bash(uniq *)", "Bash(cut *)", "Bash(tr *)", "Bash(awk *)",
      "Bash(sed *)", "Bash(echo *)", "Bash(printf *)", "Bash(test *)", "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)",
      "Bash(rm *)", "Bash(touch *)", "Bash(chmod *)", "Bash(diff *)", "Bash(which *)", "Bash(xargs *)", "Bash(pwd)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Task", "hooks": [ { "type": "command", "command": "'"$gc"'" } ] },
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "'"$gb"'" } ] }
    ],
    "PostToolUse": [ { "matcher": "Task", "hooks": [ { "type": "command", "command": "'"$ld"'" } ] } ],
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "'"$ga"'" } ] } ]
  }
}'
      if [ -e "$cbase/settings.json" ] && [ ! -L "$cbase/settings.json" ]; then
        printf '%s\n' "$sjson" > "$cbase/settings.harness.json"
        HARDMSG="on → хуки в $cbase/hooks; settings.json есть → слей $cbase/settings.harness.json вручную"
      else
        printf '%s\n' "$sjson" > "$cbase/settings.json"
        HARDMSG="on → Claude-хуки ($cbase/settings.json)"
      fi
      ;;
    codex)
      HARDMSG="инструкция (Codex без жёсткого enforce — harness/enforcement/codex/README.md)"
      ;;
  esac
fi

# --- opencode runner-конфиг: global провайдер/omo-преflight + минимальный проектный opencode.jsonc ---
# Провайдер+auth → global (~/.config/opencode, шарится); проект → permission+plugin (rational-guardrail,
# относительным путём), omo вычищается. Модели — во frontmatter (models.config), сюда НЕ пишутся.
OPENCODE_MSG=""
if [ "$RUNNER" = opencode ] && [ "$SCOPE" != global ] && command -v node >/dev/null 2>&1; then
  [ "$NOINPUT" = yes ] && export RATIONALDEV_NOINPUT=1
  node "$BUNDLE/harness/setup-opencode.mjs" "$PROJ" "$BUNDLE" || true
  OPENCODE_MSG="$PROJ/opencode.jsonc (permission+plugin) · провайдер в ~/.config/opencode"
  # setup-opencode авто-подключил харнес-инструкции через opencode.jsonc "instructions" — правим note
  [ -e "$PROJ/AGENTS.harness.md" ] && INSTR_NOTE="$(basename "$PROJ")/AGENTS.md (твой) + AGENTS.harness.md — авто через opencode.jsonc instructions"
fi

MODELS_MSG="(node не найден)"
if command -v node >/dev/null 2>&1; then
  MODELS_MSG="$(node -e 'const fs=require("fs");const c=(JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[process.argv[2]]||{});const t=(c.tiers||{});const f=v=>v||"(наследует)";process.stdout.write(`large=${f(t.large)} small=${f(t.small)}`)' "$BUNDLE/harness/models.config.json" "$RUNNER" 2>/dev/null || echo "см. harness/models.config.json")"
fi

echo "rationaldev harness → $RUNNER ($SCOPE)"
echo "  agents/roles: $AGENTS_DST ($(count "$AGENTS_DST"))"
echo "  skills:       $SKILLS_DST ($(count "$SKILLS_DST"))"
echo "  models:       $MODELS_MSG (2 тира: large=суждение · small=исполнение)"
echo "  instructions: $INSTR_NOTE"
echo "  hard mode:    $HARDMSG"
[ -n "$OPENCODE_MSG" ] && echo "  opencode cfg: $OPENCODE_MSG"
echo
echo "Точка входа — роль 'izi' (запусти: $RUNNER --agent izi)."
