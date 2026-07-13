#!/usr/bin/env sh
# Детерминированный scaffold: клонирует СОДЕРЖИМОЕ git-шаблона в рабочее дерево проекта
# (через `git archive` — только трекнутые файлы, БЕЗ .git шаблона) и переименовывает go-module.
# НЕ трогает .git/origin ПРОЕКТА. Сохраняет уже замороженный api-specification/ (его положил apidesigner).
# НЕ LLM — просто clone+rename+build (экономим токены). Компонентные тесты и фикс — на @scaffolder.
#
# Запуск: sh scaffold.sh <service-name> [template-repo-dir]
#   template по умолчанию: $HOME/IdeaProjects/codemonstersdev/template-go-api (git-репо)
# exit 0 = накатан + go build зелёный; 1 = входная ошибка; 2 = build красный.
set -eu
SVC="${1:?usage: scaffold.sh <service-name> [template-repo-dir]}"
DEST="$(pwd)"
# Шаблон: явный 2-й арг > ПРОФИЛЬ ФОРМЫ (target-profiles.json по маркеру .agent/planner/target) > дефолт.
# Делегируем target-профилю — не хардкодим форму (см. skill target-profiles). jq рядом с scaffold.sh (симлинк install).
PROFILES="$(dirname "$0")/target-profiles.json"
if [ -n "${2:-}" ]; then
  TPL="$2"
elif [ -f "$PROFILES" ] && command -v jq >/dev/null 2>&1; then
  SHAPE="$(tr -d '[:space:]' < "$DEST/.agent/planner/target" 2>/dev/null || true)"
  [ -n "$SHAPE" ] || SHAPE="$(jq -r '.default' "$PROFILES")"
  TNAME="$(jq -r --arg s "$SHAPE" '.profiles[$s].template // .profiles[.default].template' "$PROFILES")"
  TPL="$HOME/IdeaProjects/codemonstersdev/$TNAME"
  echo "scaffold: форма '$SHAPE' → шаблон $TNAME"
else
  TPL="$HOME/IdeaProjects/codemonstersdev/template-go-api"
fi
git -C "$TPL" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "scaffold: $TPL не git-репозиторий"; exit 1; }
OLDMOD="$(awk '/^module /{print $2; exit}' "$TPL/go.mod" 2>/dev/null || true)"
[ -n "$OLDMOD" ] || { echo "scaffold: в шаблоне нет 'module' в go.mod"; exit 1; }

echo "scaffold: git-шаблон $TPL (module=$OLDMOD) → проект '$SVC' (.git/origin проекта не трогаю)"

# 1) Клон содержимого шаблона из git (трекнутые файлы, БЕЗ .git шаблона) во временный каталог.
TMP="$(mktemp -d)"
git -C "$TPL" archive HEAD | tar -x -C "$TMP"

# 2) Внести в проект, сохранив замороженный api-specification (не перезаписывать).
for item in "$TMP"/* "$TMP"/.[!.]*; do
  [ -e "$item" ] || continue
  n="$(basename "$item")"
  if [ "$n" = "api-specification" ] && [ -d "$DEST/api-specification" ] && [ -n "$(ls -A "$DEST/api-specification" 2>/dev/null)" ]; then
    echo "scaffold: сохраняю замороженный контракт api-specification/ (openapi | config+report schema — не перезаписываю)"; continue
  fi
  # README.md — артефакт дизайна (его пишет moduledesigner: спека→документация→код). Если уже есть —
  # НЕ перезаписывать шаблонной заглушкой (тот же принцип, что и с замороженным контрактом).
  if [ "$n" = "README.md" ] && [ -s "$DEST/README.md" ]; then
    echo "scaffold: сохраняю README.md дизайна (не перезаписываю шаблонной заглушкой)"; continue
  fi
  cp -R "$item" "$DEST/"
done
rm -rf "$TMP"

# 3) Rename go-module OLDMOD → SVC во всех .go и go.mod (perl -i — портируемо macOS/Linux).
find "$DEST" \( -path "$DEST/.opencode" -o -path "$DEST/harness" -o -path "$DEST/.git" \) -prune -o \
  \( -name '*.go' -o -name 'go.mod' \) -print 2>/dev/null | while IFS= read -r f; do
  perl -i -pe "s/\Q$OLDMOD\E/$SVC/g" "$f" 2>/dev/null || true
done

# 4) Билд-проверка.
cd "$DEST"
if go build ./... 2>/tmp/scaffold-build.log; then
  echo "scaffold: OK — шаблон накатан, go build зелёный ($SVC)"
  exit 0
else
  echo "scaffold: go build КРАСНЫЙ (чинит @scaffolder):"; sed 's/^/  /' /tmp/scaffold-build.log 2>/dev/null
  exit 2
fi
