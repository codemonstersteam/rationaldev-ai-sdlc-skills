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

# Детект логин-оболочки → ровно один из zsh|bash|fish|other.
# Приоритет: $RATIONALDEV_SHELL override > basename $SHELL > `ps -p $PPID -o comm=` (снять ведущий '-') > sh.
rd_detect_shell() {
  _sh="${RATIONALDEV_SHELL:-}"
  if [ -z "$_sh" ] && [ -n "${SHELL:-}" ]; then _sh="$(basename "$SHELL")"; fi
  if [ -z "$_sh" ]; then
    _c="$(ps -p "$PPID" -o comm= 2>/dev/null | sed 's/^-//' || true)"
    [ -n "$_c" ] && _sh="$(basename "$_c")"
  fi
  [ -z "$_sh" ] && _sh="sh"
  case "$_sh" in
    zsh)  echo zsh ;;
    bash) echo bash ;;
    fish) echo fish ;;
    *)    echo other ;;
  esac
}

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

# 2) команда `rationaldev` в PATH: симлинк в $BINDIR + проводка PATH ТОЛЬКО в rc обнаружённой оболочки.
# Идемпотентность — по МАРКЕРУ (не по $PATH: $PATH врёт про содержимое rc). Файл создаём, если его нет.
mkdir -p "$BINDIR"
ln -sfn "$HOME_DIR/rationaldev" "$BINDIR/rationaldev"

MARKER="# rationaldev bin (bootstrap)"
WIRED_NOTE=""      # человекочитаемый отчёт (что за файл / уже был / добавлено)

# Дописать POSIX-проводку (export PATH=…) в $1, если маркера там ещё нет. Файл создаётся при отсутствии.
wire_posix() {
  _f="$1"
  mkdir -p "$(dirname "$_f")"
  [ -e "$_f" ] || : > "$_f"
  if grep -qF "$MARKER" "$_f" 2>/dev/null; then
    WIRED_NOTE="${WIRED_NOTE}    $_f — уже проведён (маркер есть)\n"
  else
    printf '\n%s\nexport PATH="%s:$PATH"\n' "$MARKER" "$BINDIR" >> "$_f"
    WIRED_NOTE="${WIRED_NOTE}    $_f — добавлена проводка PATH\n"
  fi
}

# fish: fish_add_path идемпотентен сам; рядом кладём маркер-комментарий для доктора/повторных прогонов.
wire_fish() {
  _f="$1"
  mkdir -p "$(dirname "$_f")"
  [ -e "$_f" ] || : > "$_f"
  if grep -qF "$MARKER" "$_f" 2>/dev/null; then
    WIRED_NOTE="${WIRED_NOTE}    $_f — уже проведён (маркер есть)\n"
  else
    printf '\n%s\nfish_add_path "%s"\n' "$MARKER" "$BINDIR" >> "$_f"
    WIRED_NOTE="${WIRED_NOTE}    $_f — добавлена проводка PATH (fish_add_path)\n"
  fi
}

DETECTED_SHELL="$(rd_detect_shell)"
case "$DETECTED_SHELL" in
  zsh)
    wire_posix "${ZDOTDIR:-$HOME}/.zshrc"
    RELOAD="source \"${ZDOTDIR:-$HOME}/.zshrc\""
    ;;
  bash)
    # оба — файлы САМОГО bash: .bashrc (интерактивный) и .bash_profile (macOS-логин читает его)
    wire_posix "$HOME/.bashrc"
    wire_posix "$HOME/.bash_profile"
    RELOAD="source ~/.bashrc"
    ;;
  fish)
    wire_fish "$HOME/.config/fish/config.fish"
    RELOAD="exec fish"
    ;;
  *)
    wire_posix "$HOME/.profile"
    RELOAD="открой новый терминал (или войди заново)"
    ;;
esac

# $PATH используем ТОЛЬКО для формулировки отчёта (активно в сессии vs перезапусти оболочку).
case ":$PATH:" in
  *":$BINDIR:"*) SESSION_NOTE="  ($BINDIR уже активен в текущей сессии)" ;;
  *)             SESSION_NOTE="  (чтобы включить сейчас — перезапусти оболочку: $RELOAD)" ;;
esac
# Авто-апдейт ОТКЛЮЧЁН (пока только ручной `rationaldev update`). Никаких shell/hook/plugin-триггеров.

printf '\nГотово. Канонический клон: %s ; команда: %s\n' "$HOME_DIR" "$BINDIR/rationaldev"
printf '  оболочка: %s — правил rc:\n' "$DETECTED_SHELL"
printf '%b' "$WIRED_NOTE"
printf '%s\n' "$SESSION_NOTE"
cat <<EOF
  Подключить репо:   rationaldev install <path-to-repo> [claude|opencode|codex]
  Обновить вручную:  rationaldev update
  Обновление:        rationaldev update   (вручную; авто-апдейт пока отключён)
EOF
