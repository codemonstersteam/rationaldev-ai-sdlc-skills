#!/usr/bin/env sh
# Подключает харнес rationaldev к выбранному раннеру (симлинки).
#
#   ./install.sh <claude|codex|opencode> [--global | <project-dir>] [--hard]
#
#   ./install.sh opencode --global         # глобально для всех проектов
#   ./install.sh claude ~/myproject        # в конкретный проект
#   ./install.sh codex                     # в текущую директорию
#   ./install.sh opencode . --hard         # + enforcement-адаптер (Slice 6)
#
# Идемпотентно (ln -sfn). Источник правды: skills/lib + harness/agents.
set -eu

BUNDLE="$(cd "$(dirname "$0")" && pwd)"
LIB="$BUNDLE/skills/lib"

RUNNER="${1:-}"
[ -n "$RUNNER" ] || { echo "usage: ./install.sh <claude|codex|opencode> [--global | <dir>] [--hard]"; exit 1; }
shift

SCOPE="project"; PROJ="$(pwd)"; HARD="no"
for arg in "$@"; do
  case "$arg" in
    --global) SCOPE="global" ;;
    --hard)   HARD="yes" ;;
    *)        PROJ="$arg" ;;
  esac
done

# --- хелперы ---
link_dir_skills() {  # $1 = каталог назначения скиллов
  dst="$1"; mkdir -p "$dst/reference"
  for item in "$LIB"/*; do
    name="$(basename "$item")"
    if [ -d "$item" ] && [ -f "$item/SKILL.md" ]; then
      ln -sfn "$item" "$dst/$name"
    elif [ -f "$item" ]; then
      ln -sfn "$item" "$dst/reference/$name"
    fi
  done
}
link_agents() {  # $1 = каталог назначения, $2 = каталог-источник проекций
  dst="$1"; src="$2"; mkdir -p "$dst"
  for f in "$src"/*.md; do ln -sfn "$f" "$dst/$(basename "$f")"; done
}
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
      HARDMSG="on → OpenCode-плагин ($pdir/rational-guardrail.ts)"
      ;;
    claude)
      [ "$SCOPE" = global ] && cbase="$HOME/.claude" || cbase="$PROJ/.claude"
      mkdir -p "$cbase/hooks"
      ln -sfn "$ADAPTER/gate-check.sh"   "$cbase/hooks/gate-check.sh"
      ln -sfn "$ADAPTER/log-decision.sh" "$cbase/hooks/log-decision.sh"
      gc="$cbase/hooks/gate-check.sh"; ld="$cbase/hooks/log-decision.sh"
      sjson='{
  "hooks": {
    "PreToolUse": [ { "matcher": "Task", "hooks": [ { "type": "command", "command": "'"$gc"'" } ] } ],
    "PostToolUse": [ { "matcher": "Task", "hooks": [ { "type": "command", "command": "'"$ld"'" } ] } ]
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

echo "rationaldev harness → $RUNNER ($SCOPE)"
echo "  agents/roles: $AGENTS_DST ($(count "$AGENTS_DST"))"
echo "  skills:       $SKILLS_DST ($(count "$SKILLS_DST"))"
echo "  instructions: $INSTR_NOTE"
echo "  hard mode:    $HARDMSG"
echo
echo "Точка входа — роль 'orchestrator'. Дальше: запусти $RUNNER в проекте."
