#!/usr/bin/env sh
# Смоук `rationaldev update` (T3): ff-pull, up-to-date, pristine-abort. Локальный bare-remote, без сети.
set -eu
# CI хардит git file-transport (CVE-2022-39253) → clone/fetch локального bare-remote блокируется.
# Смоук использует ТОЛЬКО локальные тест-репо → разрешаем file-протокол для всех git-вызовов (вкл. дочерний
# git внутри `rationaldev`). Применяется лишь в процессе смоука; продакшн-`rationaldev` это не трогает.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=protocol.file.allow GIT_CONFIG_VALUE_0=always
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$REPO/rationaldev"
pass=0; fail() { echo "FAIL: $1"; exit 1; }; ok() { pass=$((pass+1)); }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
REMOTE="$T/remote.git"; CLONE="$T/clone"
# -b main: default-ветка remote = main (иначе на CI, где init.defaultBranch=master, клон получает unborn HEAD
# → `git rev-parse HEAD` = "fatal: Needed a single revision", и ff-update падает).
git init -q --bare -b main "$REMOTE"
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

# --- autocheck (T4 периодика): пере-склонируем и продвинем remote на 1 коммит ---
CLONE2="$T/clone2"; ST="$T/state"
git clone -q "$REMOTE" "$CLONE2" 2>/dev/null
( cd "$T/seed" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m next2 && git push -q origin HEAD:main )
# 5. notify: есть отставание → сообщает про обновление
RATIONALDEV_HOME="$CLONE2" RATIONALDEV_STATE="$ST" RATIONALDEV_UPDATE=notify sh "$BIN" autocheck | grep -q "доступно обновление" || fail "notify не сообщил"; ok
# 6. throttle: сразу второй раз → молчит (метка свежая)
out="$(RATIONALDEV_HOME="$CLONE2" RATIONALDEV_STATE="$ST" RATIONALDEV_UPDATE=notify sh "$BIN" autocheck)"
[ -z "$out" ] || fail "throttle не сработал (ждали тишину)"; ok
# 7. off: ничего даже без throttle
rm -f "$ST/last-update-check"
out="$(RATIONALDEV_HOME="$CLONE2" RATIONALDEV_STATE="$ST" RATIONALDEV_UPDATE=off sh "$BIN" autocheck)"
[ -z "$out" ] || fail "off не молчит"; ok
# 8. auto: тянет обновление
rm -f "$ST/last-update-check"
RATIONALDEV_HOME="$CLONE2" RATIONALDEV_STATE="$ST" RATIONALDEV_UPDATE=auto sh "$BIN" autocheck | grep -q "обновлено" || fail "auto не подтянул"; ok

echo "PASS $pass/8 — rationaldev update+autocheck smoke"
