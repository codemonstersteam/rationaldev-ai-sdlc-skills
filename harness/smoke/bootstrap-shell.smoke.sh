#!/usr/bin/env sh
# Смоук авто-детекта оболочки в bootstrap.sh: PATH-проводка идёт ТОЛЬКО в rc обнаружённой оболочки,
# идемпотентно (по маркеру). Полностью изолирован: фейковый $HOME на кейс, RATIONALDEV_REPO = ЭТОТ
# репозиторий (клон локальный, без сети), реальный $HOME НЕ трогается.
set -eu
# CI хардит git file-transport (CVE-2022-39253); смоук клонирует только локальный репо → разрешаем file.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=protocol.file.allow GIT_CONFIG_VALUE_0=always
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="# rationaldev bin (bootstrap)"
pass=0; fail() { echo "FAIL: $1"; exit 1; }; ok() { pass=$((pass+1)); }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
CANON="$T/canon"   # общий канонический «клон».
# Тестируем ТОЛЬКО PATH-проводку, не git-клон. Пред-сид без единого branch/сеть-зависимого git-вызова:
# фейкуем «клон уже есть» (bootstrap проверяет [ -d $HOME/.git ]) + кладём сам скрипт rationaldev, чтобы
# bootstrap пошёл веткой «клон есть → update||true» и НЕ делал `git clone --branch main` (тот падал на CI,
# где checkout — PR-ветка без ref main). update внутри git-фейлит на фейковом .git и глотается `|| true`;
# затем отрабатывает step 2 (wiring), который и проверяем.
mkdir -p "$CANON/.git"
cp "$REPO/rationaldev" "$CANON/rationaldev"
export RATIONALDEV_UPDATE=off   # без autocheck-сети

# Прогнать bootstrap с фейковым HOME и заданным override оболочки. _ov="" ⇒ RATIONALDEV_SHELL НЕ задан:
# детект падает на $SHELL, который мы ставим в нераспознанный /bin/sh → ветка other (детерминированно).
run_bootstrap() {
  _h="$1"; _ov="$2"; mkdir -p "$_h"
  if [ -n "$_ov" ]; then
    RATIONALDEV_SHELL="$_ov" HOME="$_h" RATIONALDEV_REPO="$REPO" RATIONALDEV_HOME="$CANON" \
      sh "$REPO/bootstrap.sh" >/dev/null 2>&1
  else
    SHELL=/bin/sh HOME="$_h" RATIONALDEV_REPO="$REPO" RATIONALDEV_HOME="$CANON" \
      sh "$REPO/bootstrap.sh" >/dev/null 2>&1
  fi
}
has()  { [ -f "$1" ] && grep -qF "$2" "$1"; }
nhas() { ! has "$1" "$2"; }

# --- fish → config.fish содержит fish_add_path ---
H="$T/fish"; run_bootstrap "$H" fish
has  "$H/.config/fish/config.fish" "fish_add_path" || fail "fish: нет fish_add_path в config.fish"; ok
nhas "$H/.zshrc"  "$MARKER"                    || fail "fish: маркер просочился в .zshrc"; ok
nhas "$H/.bashrc" "$MARKER"                    || fail "fish: маркер просочился в .bashrc"; ok

# --- zsh → маркер в .zshrc, НЕТ в .bashrc / .bash_profile / config.fish / .profile ---
H="$T/zsh"; run_bootstrap "$H" zsh
has  "$H/.zshrc" "$MARKER"                     || fail "zsh: нет маркера в .zshrc"; ok
nhas "$H/.bashrc" "$MARKER"                    || fail "zsh: маркер в .bashrc (чужой)"; ok
nhas "$H/.bash_profile" "$MARKER"              || fail "zsh: маркер в .bash_profile (чужой)"; ok
nhas "$H/.config/fish/config.fish" "$MARKER"   || fail "zsh: маркер в config.fish (чужой)"; ok
nhas "$H/.profile" "$MARKER"                   || fail "zsh: маркер в .profile (чужой)"; ok

# --- bash → маркер в .bashrc И .bash_profile (macOS-логин читает .bash_profile), НЕ в чужих ---
H="$T/bash"; run_bootstrap "$H" bash
has  "$H/.bashrc" "$MARKER"                    || fail "bash: нет маркера в .bashrc"; ok
has  "$H/.bash_profile" "$MARKER"              || fail "bash: нет маркера в .bash_profile"; ok
nhas "$H/.zshrc" "$MARKER"                     || fail "bash: маркер в .zshrc (чужой)"; ok
nhas "$H/.profile" "$MARKER"                   || fail "bash: маркер в .profile (чужой)"; ok

# --- other → .profile ---
H="$T/other"; run_bootstrap "$H" other
has  "$H/.profile" "$MARKER"                   || fail "other: нет маркера в .profile"; ok
nhas "$H/.zshrc" "$MARKER"                     || fail "other: маркер в .zshrc (чужой)"; ok

# --- пусто (RATIONALDEV_SHELL не задан; $SHELL=/bin/sh нераспознан) → other → .profile ---
H="$T/empty"; run_bootstrap "$H" ""
has  "$H/.profile" "$MARKER"                   || fail "empty: нет маркера в .profile (ждали other-ветку)"; ok

# --- идемпотентность: повторный прогон не дублирует маркер ---
H="$T/idem"; run_bootstrap "$H" zsh; run_bootstrap "$H" zsh
c="$(grep -cF "$MARKER" "$H/.zshrc" 2>/dev/null || true)"
[ "$c" = 1 ] || fail "идемпотентность: маркер в .zshrc не единственный ($c)"; ok

echo "PASS $pass — bootstrap shell-detect smoke (fish/zsh/bash/other/пусто + идемпотентность)"
