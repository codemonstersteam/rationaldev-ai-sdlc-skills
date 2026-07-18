#!/usr/bin/env sh
# rationaldev bootstrap (self-update T1) — клонирует харнес в канонический $RATIONALDEV_HOME.
# Как oh-my-zsh:  sh -c "$(curl -fsSL <repo-raw>/bootstrap.sh)"
# Или локально:   RATIONALDEV_REPO=<url|path> RATIONALDEV_HOME=~/.rationaldev sh bootstrap.sh
#
# Устанавливает ОДИН канонический клон; проекты подключаются к нему `install.sh` (dir-symlinks, T2),
# обновляются `rationaldev update` (T3) / периодикой (T4). Idempotent: клон уже есть → апдейтит.
set -eu

REPO="${RATIONALDEV_REPO:-https://github.com/codemonstersteam/rationaldev-ai-sdlc-skills.git}"
HOME_DIR="${RATIONALDEV_HOME:-$HOME/.rationaldev}"
CHANNEL="${RATIONALDEV_CHANNEL:-main}"

command -v git >/dev/null 2>&1 || { echo "rationaldev bootstrap: нужен git"; exit 1; }

if [ -d "$HOME_DIR/.git" ]; then
  echo "rationaldev: канонический клон уже есть в $HOME_DIR → обновляю"
  RATIONALDEV_HOME="$HOME_DIR" RATIONALDEV_CHANNEL="$CHANNEL" sh "$HOME_DIR/rationaldev" update || true
else
  echo "rationaldev: клонирую $REPO → $HOME_DIR (канал $CHANNEL)"
  git clone --quiet --branch "$CHANNEL" "$REPO" "$HOME_DIR"
  echo "rationaldev: клон готов ($(git -C "$HOME_DIR" rev-parse --short HEAD))"
fi

cat <<EOF

Готово. Канонический клон: $HOME_DIR
  Подключить проект:  sh $HOME_DIR/install.sh <claude|opencode|codex> <project-dir> --hard
  Обновить вручную:   RATIONALDEV_HOME=$HOME_DIR sh $HOME_DIR/rationaldev update
  Периодика:          RATIONALDEV_UPDATE=auto|notify|off  (см. self-update T4)
EOF
