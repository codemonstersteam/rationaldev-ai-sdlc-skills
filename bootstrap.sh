#!/usr/bin/env sh
# rationaldev bootstrap — ПЕРВИЧНЫЙ метод установки (как oh-my-zsh). Клонирует харнес в канонический
# $RATIONALDEV_HOME и ставит команду `rationaldev` в PATH. Дальше подключение любого репо — одной командой:
#   rationaldev install <path-to-repo>
#
#   sh  -c "$(curl -fsSL <repo-raw>/bootstrap.sh)"        # zsh/bash аналогично
#   RATIONALDEV_REPO=<url|path> RATIONALDEV_HOME=~/.rationaldev sh bootstrap.sh
#
# Клон потребляется read-only; проекты — dir-symlinks на него (T2), обновление — `rationaldev update`/периодика (T4).
# Idempotent: клон уже есть → апдейтит. Репо ПУБЛИЧНЫЙ → HTTPS clone/pull анонимно, ноль настройки (как omz).
# Форк/зеркало/SSH — через RATIONALDEV_REPO=<url>.
set -eu

REPO="${RATIONALDEV_REPO:-https://github.com/codemonstersteam/rationaldev-ai-sdlc-skills.git}"
HOME_DIR="${RATIONALDEV_HOME:-$HOME/.rationaldev}"
CHANNEL="${RATIONALDEV_CHANNEL:-main}"
BINDIR="${RATIONALDEV_BIN:-$HOME/.local/bin}"

command -v git >/dev/null 2>&1 || { echo "rationaldev bootstrap: нужен git"; exit 1; }

# 1) канонический клон
if [ -d "$HOME_DIR/.git" ]; then
  echo "rationaldev: канонический клон уже есть в $HOME_DIR → обновляю"
  RATIONALDEV_HOME="$HOME_DIR" RATIONALDEV_CHANNEL="$CHANNEL" sh "$HOME_DIR/rationaldev" update || true
else
  echo "rationaldev: клонирую $REPO → $HOME_DIR (канал $CHANNEL)"
  git clone --quiet --branch "$CHANNEL" "$REPO" "$HOME_DIR"
  echo "rationaldev: клон готов ($(git -C "$HOME_DIR" rev-parse --short HEAD))"
fi

# 2) команда `rationaldev` в PATH (симлинк в $BINDIR; PATH дописываем в профиль, если его там нет)
mkdir -p "$BINDIR"
ln -sfn "$HOME_DIR/rationaldev" "$BINDIR/rationaldev"
PATH_NOTE=""
case ":$PATH:" in
  *":$BINDIR:"*) : ;;                                   # уже в PATH
  *)
    for prof in "$HOME/.zshrc" "$HOME/.bashrc"; do
      [ -e "$prof" ] || continue
      grep -q "rationaldev bin (bootstrap)" "$prof" 2>/dev/null && continue
      printf '\n# rationaldev bin (bootstrap)\nexport PATH="%s:$PATH"\n' "$BINDIR" >> "$prof"
      PATH_NOTE="  ($BINDIR добавлен в PATH в $prof — открой новый терминал или 'source $prof')"
    done
    ;;
esac

cat <<EOF

Готово. Канонический клон: $HOME_DIR ; команда: $BINDIR/rationaldev
$PATH_NOTE
  Подключить репо:   rationaldev install <path-to-repo> [claude|opencode|codex]
  Обновить вручную:  rationaldev update
  Автообновление:    export RATIONALDEV_UPDATE=auto   (на старте сессии тихо git pull)
EOF
