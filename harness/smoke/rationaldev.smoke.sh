#!/usr/bin/env sh
# Смоук `rationaldev update` (T3): ff-pull, up-to-date, pristine-abort. Локальный bare-remote, без сети.
set -eu
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$REPO/rationaldev"
pass=0; fail() { echo "FAIL: $1"; exit 1; }; ok() { pass=$((pass+1)); }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
REMOTE="$T/remote.git"; CLONE="$T/clone"
git init -q --bare "$REMOTE"
git clone -q "$REMOTE" "$T/seed" 2>/dev/null
( cd "$T/seed" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init && git push -q origin HEAD:main )
git clone -q "$REMOTE" "$CLONE" 2>/dev/null
( cd "$T/seed" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m next && git push -q origin HEAD:main )

# 1. ff-update подтягивает новый коммит
RATIONALDEV_HOME="$CLONE" sh "$BIN" update | grep -q "обновлено" || fail "ff-update не подтянул коммит"; ok
# 2. повтор → уже актуально
RATIONALDEV_HOME="$CLONE" sh "$BIN" update | grep -q "уже актуально" || fail "up-to-date не распознан"; ok
# 3. грязный клон → abort (pristine-инвариант), ненулевой код
echo x > "$CLONE/dirt.txt"
if RATIONALDEV_HOME="$CLONE" sh "$BIN" update >/dev/null 2>&1; then fail "грязный клон НЕ отменил апдейт"; fi; ok
# 4. нет .git → внятная ошибка
RATIONALDEV_HOME="$T/nope" sh "$BIN" update 2>&1 | grep -q "нет git-клона" || fail "no-clone не обработан"; ok

echo "PASS $pass/4 — rationaldev update smoke"
