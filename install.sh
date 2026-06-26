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

# --- раскладка по раннеру ---
case "$RUNNER" in
  claude)
    [ "$SCOPE" = global ] && BASE="$HOME/.claude" || BASE="$PROJ/.claude"
    link_agents "$BASE/agents" "$BUNDLE/harness/agents/claude"
    link_dir_skills "$BASE/skills"
    AGENTS_DST="$BASE/agents"; SKILLS_DST="$BASE/skills"
    INSTR="$BASE/CLAUDE.md (Slice 3)"
    ;;
  opencode)
    [ "$SCOPE" = global ] && BASE="${XDG_CONFIG_HOME:-$HOME/.config}/opencode" || BASE="$PROJ/.opencode"
    link_agents "$BASE/agent" "$BUNDLE/harness/agents/opencode"
    link_dir_skills "$BASE/skills"
    AGENTS_DST="$BASE/agent"; SKILLS_DST="$BASE/skills"
    INSTR="$BASE/AGENTS.md (Slice 3)"
    ;;
  codex)
    # У Codex нет файлового формата субагентов: скиллы → .agents/skills,
    # роли стейджатся в .agents/roles (сборка в AGENTS.md — Slice 3).
    if [ "$SCOPE" = global ]; then SK="$HOME/.agents/skills"; RL="$HOME/.agents/roles"; else SK="$PROJ/.agents/skills"; RL="$PROJ/.agents/roles"; fi
    link_agents "$RL" "$BUNDLE/harness/agents/codex"
    link_dir_skills "$SK"
    AGENTS_DST="$RL"; SKILLS_DST="$SK"
    INSTR="AGENTS.md (сборка ролей — Slice 3)"
    ;;
  *) echo "unknown runner: $RUNNER (claude|codex|opencode)"; exit 1 ;;
esac

# --- enforcement (--hard, Slice 6) ---
HARDMSG="off (enforcement инструкцией)"
if [ "$HARD" = yes ]; then
  ADAPTER="$BUNDLE/harness/enforcement/$RUNNER"
  if [ -d "$ADAPTER" ]; then
    HARDMSG="on → адаптер $RUNNER подключён"
    # фактическое подключение адаптера реализуется в Slice 6
  else
    HARDMSG="запрошен, но адаптер ещё не реализован (Slice 6) — пропущено"
  fi
fi

echo "rationaldev harness → $RUNNER ($SCOPE)"
echo "  agents/roles: $AGENTS_DST ($(count "$AGENTS_DST"))"
echo "  skills:       $SKILLS_DST ($(count "$SKILLS_DST"))"
echo "  instructions: $INSTR"
echo "  hard mode:    $HARDMSG"
echo
echo "Точка входа — роль 'orchestrator'. Дальше: запусти $RUNNER в проекте."
