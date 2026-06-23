---
name: git-conventions
description: Детерминированная процедура работы с Git по стандарту Trunk-Based Development. Применять для всех операций с ветками, коммитами и PR. Рассчитан на слабую модель: пошаговые команды, валидация сообщений, STOP-правила.
version: "1.0"
---

# Git Conventions — Trunk-Based Development

## Модель ветвления

**Единственная долгоживущая ветка:** `trunk`

**Правила:**
- Все feature-ветки отводятся от `trunk`
- Время жизни feature-ветки: **максимум 2 дня**
- Время жизни bugfix-ветки: **максимум 1 день**
- Максимум **600 строк** кода в одном PR
- Рекомендуется **не более 10 файлов** в одном PR
- **Одна задача = один PR**

## Правила именования веток

```
feature/DOS-XXX  ← новая функциональность
bugfix/DOS-XXX   ← исправление бага
```

Где `DOS-XXX` — номер задачи Jira.

## Создание feature-ветки

```bash
git checkout trunk
git pull origin trunk
git checkout -b feature/DOS-XXX
```

## Ежедневное обновление ветки

```bash
git checkout trunk
git pull origin trunk
git checkout feature/DOS-XXX
git rebase trunk
```

## Подготовка к слиянию

```bash
git checkout trunk
git pull origin trunk
git checkout feature/DOS-XXX
git rebase trunk
git push origin feature/DOS-XXX
```

## Требования к сообщениям коммитов

**Формат:**
```
DOS-XXX (type): сообщение
```

**Правила:**
- Язык: **русский** (основной текст)
- Размер: **≤ 50 символов**
- Стиль: **строчные буквы**, **без точки в конце**
- Обязательно: номер задачи Jira

**Типы коммитов:**

| Тип | Когда |
|-----|-------|
| `feat` | новая функциональность |
| `fix` | исправление бага |
| `docs` | изменения в документации |
| `style` | форматирование кода (не влияет на логику) |
| `refactor` | рефакторинг кода |
| `test` | добавление или изменение тестов |
| `chore` | изменения в сборке, зависимостях |

**Примеры:**
```
DOS-01 (feat): добавлена двухфакторная аутентификация
DOS-01 (docs): актуализирована документация по методам авторизации
DOS-01 (feat)!: добавлено новое обязательное поле
```

**Breaking changes:** добавить `!` после `type`:
```
DOS-01 (refactor)!: изменён формат ответа API
```

## Валидация сообщения коммита (pre-commit)

Перед коммитом проверить сообщение:

1. Есть номер задачи Jira (`DOS-XXX`)
2. Указан тип в скобках (`feat`, `fix`, `docs`...)
3. Сообщение на русском, ≤ 50 символов, без точки
4. Для ломающих изменений — `!` после типа

**Антипримеры (НЕ делать):**
```
fix bug          ← нет номера задачи
DOS-01: fix      ← нет типа
DOS-01 (FEAT): Fix bug  ← тип заглавными, английский
DOS-01 (feat): Добавил новую фичу для пользователей  ← >50 символов
```

## Git hook для валидации

Сохранить в `.git/hooks/commit-msg`:

```bash
#!/bin/sh

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

errors=""
allowed_codes=("feat" "fix" "docs" "style" "refactor" "test" "chore")

TASK=$(echo "$commit_msg" | sed -nE 's/^([A-Z]{2,20})-.*/\1/p')
number=$(echo "$commit_msg" | sed -nE 's/^[A-Z]{2,20}-([0-9]+).*/\1/p')
code=$(echo "$commit_msg" | sed -nE 's/^[A-Z]{2,20}-[0-9]+ *\\(([a-z]+)\\):.*/\1/p')
text=$(echo "$commit_msg" | sed -nE 's/^[A-Z]{2,20}-[0-9]+ *\\([a-z]+\\): *(.*)/\1/p')

# Проверка TASK
if [ -z "$TASK" ] || ! echo "$TASK" | grep -qE '^[A-Z]{2,20}$'; then
  errors="${errors}Ошибка: TASK должен содержать от 2 до 20 заглавных латинских букв\n"
fi

# Проверка number
if ! echo "$number" | grep -qE '^[0-9]+$'; then
  errors="${errors}Ошибка: number должен быть числом\n"
else
  if [ "$number" -lt 1 ] || [ "$number" -gt 999999 ]; then
    errors="${errors}Ошибка: number должен быть от 1 до 999999\n"
  fi
fi

# Проверка code
code_valid=false
for allowed_code in "${allowed_codes[@]}"; do
  if [ "$code" = "$allowed_code" ]; then
    code_valid=true
    break
  fi
done

if ! $code_valid; then
  errors="${errors}Ошибка: code должен быть одним из значений ${allowed_codes[*]}\n"
fi

# Проверка text
if [ -z "$text" ] || [ ${#text} -lt 2 ]; then
  errors="${errors}Ошибка: текст должен содержать не менее 2 символов\n"
elif ! echo "$text" | grep -qP '[а-яА-ЯёЁ]'; then
  errors="${errors}Ошибка: text должен содержать слова на русском языке\n"
fi

if [ -n "$errors" ]; then
  printf "Commit отклонён: сообщение должно соответствовать формату TASK-number (code): text\n"
  printf "$errors"
  exit 1
fi

# Проверка почты
author_email=$(git config user.email)
domain="example.com"
if ! echo "${author_email}" | grep -qE "${domain}"; then
  echo "Commit отклонён: email автора (${author_email}) не в домене example.com"
  exit 1
fi

exit 0
```

Сделать исполняемым:
```bash
chmod +x .git/hooks/commit-msg
```

## Требования к Code Review

**SLA:**
- Время ответа: **максимум 2 часа** в рабочее время
- Время на review: **максимум 1 час** на PR
- Минимум **1 approve** для мержа

**Критерии качества PR:**
- [ ] Код соответствует стандартам кодирования
- [ ] Тесты покрывают новую функциональность
- [ ] Документация обновлена при необходимости
- [ ] Нет конфликтов с `trunk`
- [ ] CI pipeline проходит успешно

## Подготовка к пушу (чек-лист)

Перед `git push` выполнить:

```bash
# 1. Форматирование
unformatted=$(gofmt -l .); [ -n "$unformatted" ] && echo "$unformatted" && exit 1

# 2. Статический анализ
go vet ./...

# 3. Юнит-тесты
go test ./...

# 4. Компонентные тесты
./component-tests/scripts/run-tests.sh healthy
```

Все 4 шага должны быть зелёными.

## STOP-правила

Останавливаться и спрашивать оператора:

- **Ветка живёт > 2 дней** → спросить, что блокирует мерж
- **PR > 600 строк** → разбить на атомарные PR
- **Нет номера задачи Jira** → не коммитить, создать задачу
- **Сообщение коммита не проходит валидацию** → исправить до пуша
- **CI красный** → не пушить, исправить локально
- **Breaking change в API** → обновить контракт (OpenAPI/AsyncAPI) до коммита

## Алгоритм работы (пошагово)

```
1. Получить задачу из backlog.md
2. git checkout trunk && git pull origin trunk
3. git checkout -b feature/DOS-XXX
4. Реализация (TDD-цикл по модулям)
5. Локальный CI (4 шага) — все зелёные
6. git add . && git commit -m "DOS-XXX (type): сообщение"
7. git push -u origin feature/DOS-XXX
8. Открыть PR (шаблон ниже)
9. Дождаться approve (минимум 1)
10. Мерж (делает оператор)
11. git checkout trunk && git pull origin trunk
12. Удалить ветку: git branch -d feature/DOS-XXX
13. Обновить backlog.md (перенести в Done)
```

## Шаблон Pull Request

```markdown
## Задача
DOS-XXX — описание задачи

## Что сделано
- [ ] пункт 1
- [ ] пункт 2
- [ ] тесты зелёные

## Спецификация
docs/design/XXX/...

## Тесты
- юниты: X, покрытие Y%
- компонентные: Z сценариев зелёные

## Чек-лист TBD
- [x] ветка от свежего trunk
- [x] локальный CI зелёный
- [x] backlog.md обновлён
```

## Чек-лист перед коммитом

- [ ] Ветка отведена от `trunk` (не от другой feature-ветки)
- [ ] Номер задачи Jira в имени ветки
- [ ] Сообщение коммита: `DOS-XXX (type): текст`
- [ ] Текст на русском, ≤ 50 символов, без точки
- [ ] Локальный CI (4 шага) зелёный
- [ ] Файлы отформатированы (`gofmt -l` пустой)
- [ ] В PR ≤ 600 строк, ≤ 10 файлов

## Метрики (для отчётности)

| Показатель | Критерий успеха |
|------------|-----------------|
| % репозиториев с веткой `trunk` | 100% |
| % коммитов напрямую в `trunk` | 0% |
| % влитых MR без 1 approve | 0% |
| % веток `feature` > 2 дней | ≤ 10% |
| % PR > 600 строк | ≤ 20% |
