---
name: llm-client
description: LLM-специфика I/O-объекта взаимодействия с моделью (Anthropic / OpenAI-совместимые) — выбор протокола (OpenAI chat completions), structured output через response_format, фан-аут по ролям-потребителям, маркер role в стабе, фиксация реальных ответов. Применять вместе с http-io (общая дисциплина исходящего HTTP — бюджеты нагрузки/payload, спека провайдера, режимы отказа, стаб). Не применять для выбора модели под задачу — это отдельное решение. Рассчитан на слабую модель (Qwen3.5-397B-A17B, ~17B активных параметров): таблицы-решения, фикс-шаблоны, чеклисты, STOP-правила.
version: "1.0"
---

# LLM-клиент — специфика взаимодействия с моделью

> **Общая дисциплина исходящего HTTP — в скилле [`http-io`](../http-io/SKILL.md):**
> два бюджета (нагрузки и payload), curl-проба, спека провайдера (OpenAPI/AsyncAPI),
> пацинг/бэкофф, классы отказа transient/permanent/quota, стаб в Compose, мост
> «от curl к тестам с учётом формул». Этот скилл — **LLM-частности** поверх той
> дисциплины: протокол, `response_format`, фан-аут ролей, фиксация ответов.
> Зафиксировано на реальной реализации `LLMClient` (`internal/slice/<name>/io.go`,
> девлог слайса).

---

## Протокол: OpenAI-совместимый слой, не нативный API

Используем **OpenAI chat completions format** (`POST /v1/chat/completions`)
даже для Anthropic. Причина: один код работает с любым провайдером —
Anthropic, OpenAI, локальный Ollama, корпоративный прокси.

```
Anthropic base URL: https://api.anthropic.com/v1
Endpoint:          POST {base_url}/chat/completions
Auth header:       Authorization: Bearer <key>
```

Нативный Anthropic API (`POST /v1/messages`, заголовок `x-api-key`,
поле `anthropic-version`) — **не используем**. Он даёт больше возможностей
(thinking, citations), но ломает провайдер-агностичность.

**Ловушка:** дефолтный `baseURL = "https://api.anthropic.com"` без `/v1`
даёт `POST https://api.anthropic.com/chat/completions` — 404 или 400.
Всегда включать `/v1` в `baseURL` (curl-проба ловит это до кода — см. `http-io`).

Машинная спека этого среза провайдера —
`api-specification/providers/anthropic-openai-compat.openapi.yaml`
(из неё выводятся структуры клиента и стаб; см. `http-io` → «Спека провайдера»).

---

## Structured output — обязателен

Без `response_format` модель оборачивает JSON в markdown-блок
(` ```json ... ``` `), даже при явной инструкции «только JSON».
Это ломает парсинг — формат вывода задаётся API-механизмом, не инструкцией в тексте.

**Правильный запрос для Anthropic (OpenAI-слой):**

```json
{
  "model": "claude-sonnet-4-6",
  "messages": [...],
  "max_tokens": 4096,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "verdict",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "status": {"type": "string", "enum": ["PASS", "FAIL", "PARTIAL"]},
          "score":  {"type": "integer"},
          "gaps":   {"type": "array", "items": {"type": "string"}}
        },
        "required": ["status", "score", "gaps"],
        "additionalProperties": false
      }
    }
  }
}
```

**Ловушки `response_format` у Anthropic** (три итерации curl, зафиксированы в девлоге слайса):
- `"type": "json_object"` → 400 `Input should be 'json_schema'`
- Без `"strict": true` → 400 `Field required`
- Без `"additionalProperties": false` → 400 при некоторых схемах

С `json_schema + strict: true + additionalProperties: false` модель возвращает
чистый JSON строкой в `choices[0].message.content` без обёрток.

**Fallback-парсинг** оставляем как второй эшелон — на случай провайдера, не
поддерживающего `response_format`:

```go
// extractJSON вырезает первый JSON-объект из строки ответа модели,
// игнорируя markdown-обёртки и любой текст вокруг.
func extractJSON(s string) string {
    start := strings.Index(s, "{")
    end := strings.LastIndex(s, "}")
    if start == -1 || end == -1 || end < start {
        return s
    }
    return s[start : end+1]
}
```

`extractJSON` юнит-тестируется на фикстурах «чистый JSON» и «```json```-обёртка»
(см. `http-io` → «От curl к тестам»).

---

## Фан-аут по ролям-потребителям

Если задача требует независимой оценки от лица нескольких потребителей,
`Ask(PromptSet) -> []Verdict` делает **N независимых вызовов** (по одному на роль),
каждый — один и тот же входной корпус под своим промптом роли. Результаты
**не усредняются** — N независимых score.

Например, роли maintainer / consumer / manager / agent — каждая смотрит на
один и тот же корпус документации со своей точки зрения. Число и состав ролей
зависят от слайса; сама схема «один корпус → N промптов → N независимых вердиктов»
универсальна.

Это N последовательных вызовов → попадает прямо под бюджет нагрузки и пацинг из
[`http-io`](../http-io/SKILL.md): `N × токены/вызов ≤ TPM`, пауза/бэкофф между
вызовами. Промпты ролей — в конфиге (`prompts:`), дорабатываются без пересборки.

---

## Стаб: различение ролей маркером `role:<key>`

Общая механика стаба (отдельный HTTP-сервис в Compose, тот же эндпоинт,
`POST /control` для режима) — в [`http-io`](../http-io/SKILL.md). LLM-специфика:
стаб различает вердикт по роли через маркер `role:<key>` в теле промпта.
**Дефолтные промпты обязаны нести этот маркер.**

```go
func detectRole(r *http.Request) string {
    b, _ := io.ReadAll(r.Body)
    body := strings.ToLower(string(b))
    for _, role := range []string{"maintainer", "consumer", "manager", "agent"} {
        if strings.Contains(body, "role:"+role) {
            return role
        }
    }
    return "maintainer"
}
```

Реальный провайдер маркер игнорирует; стаб реагирует детерминированно. Это даёт
специфицировать независимость и не-усреднение score по ролям. Дополнительный
LLM-режим стаба `markdown_fenced` (вердикт в ```json```-обёртке) специфицирует,
что клиент обязан справляться с ответом без `response_format`.

---

## Тестовые данные: фиксировать реальные ответы модели

При первом успешном прогоне на реальной модели — сохранить ответ в
`component-tests/testdata/real-responses/<repo>-<slice>.json`:

```json
{
  "_meta": {
    "source": "real Sonnet (claude-sonnet-4-6)",
    "repo": "<целевой репозиторий>",
    "docs_checked": ["README.md", "CLAUDE.md", "CONTRIBUTING.md", "AGENTS.md"],
    "date": "YYYY-MM-DD"
  },
  "result": { ... }
}
```

На основе этих данных — отдельный режим стаба (`good_repo`, `bad_repo`): стаб
возвращает зафиксированные вердикты детерминированно, воспроизводя поведение
реальной модели без сети. Покрыть минимум два варианта:
- **Хороший вход** (часть ролей FAIL/PARTIAL — это норма, не провал);
- **Плохой вход** (все роли FAIL, score 2-3, gaps про отсутствие содержимого).

---

## STOP-правила

Останавливайся и спрашивай оператора, не угадывай:

- Провайдер не поддерживает `response_format` / `json_schema` (curl показал 400)
  → STOP, согласуй fallback-стратегию (`extractJSON` как второй эшелон — решение,
  не молчаливый дефолт).
- Структура ответа не совпала с зафиксированной спекой провайдера
  (`api-specification/providers/<name>.openapi.yaml`) → STOP: клиент и стаб должны
  выводиться из одного контракта.
- Нет реального ответа модели для фиксации в фикстуру
  (`testdata/real-responses/`) → STOP, получи прогон на реальной модели: стаб
  воспроизводит зафиксированный ответ, а не выдуманный.

## Чеклист LLM-специфики

(общий чеклист исходящего HTTP — в [`http-io`](../http-io/SKILL.md))

- [ ] протокол — OpenAI chat completions; `baseURL` с `/v1`; `Authorization: Bearer`
- [ ] `response_format.type = "json_schema"` + `strict: true` + `additionalProperties: false`
- [ ] fallback `extractJSON` после `response_format`, юнит-тест на чистый + fenced
- [ ] фан-аут ролей (если он есть в слайсе); вердикты не усредняются; промпты ролей в конфиге
- [ ] дефолтные промпты несут маркер `role:<key>`; стаб различает роль по нему
- [ ] LLM-режим стаба `markdown_fenced`
- [ ] реальные ответы сохранены в `testdata/real-responses/`; режимы `good_repo`/`bad_repo`

---

## Перед коммитом

Два обязательных шага — системные ошибки CI из практики (общие для всех слайсов,
здесь — потому что новая зависимость и I/O появились именно тут):

**1. gofmt**

```bash
gofmt -l ./internal/slice/<name>/     # пусто = чисто; иначе gofmt -w
```

Проверять все `.go`-файлы слайса перед каждым коммитом. gofmt-ошибка в CI —
признак пропущенного шага, а не нового правила.

**2. go.sum в Dockerfile**

Если в слайсе появилась новая зависимость (`go.mod` изменился):
- `go.sum` закоммичен (`git add go.sum`);
- `Dockerfile.runtime` копирует оба файла:
  ```dockerfile
  COPY go.mod go.sum ./
  RUN go mod download
  ```

Без `go.sum` в образе `go build` падает с
`missing go.sum entry for module providing package <dep>`
даже если go.sum есть в репозитории.
