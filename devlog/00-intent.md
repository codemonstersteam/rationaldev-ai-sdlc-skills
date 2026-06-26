# 00 — Намерение

## Что строим

<!-- TODO: название, суть, стек -->
**Название** — описание сервиса.

Стек: ...

## Зачем этот devlog

<!-- TODO: цель документирования -->
Фиксируем весь процесс разработки: дословные промпты, решения, альтернативы.
Цель — ...

## Что умеет сервис

<!-- TODO: список функций -->
- ...
- ...

## REST API

<!-- TODO: таблица эндпоинтов -->

| Метод | Ресурс | Действие |
|-------|--------|----------|
| POST | /... | ... |

## Как работает WebAuthn

Все бинарные данные между браузером и сервером передаются в **base64url**.

### Регистрация

**Фаза 1** — клиент → сервер:
```json
{ "handle": "alice" }
```

Сервер создаёт challenge, сохраняет сессию, возвращает `201`:
```json
{
  "id": "uuid",
  "options": {
    "challenge": "base64url",
    "rp": { "name": "Passkey Demo", "id": "localhost" },
    "user": { "id": "base64url", "name": "alice", "displayName": "alice" },
    "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }],
    "timeout": 60000,
    "attestation": "none"
  }
}
```

**Фаза 2** — браузер вызывает `navigator.credentials.create(options)`, аутентификатор создаёт ключевую пару. Клиент → сервер:
```json
{
  "id": "base64url",
  "rawId": "base64url",
  "type": "public-key",
  "response": {
    "clientDataJSON": "base64url",
    "attestationObject": "base64url"
  }
}
```

- `clientDataJSON` (после decode): `{"type":"webauthn.create","challenge":"...","origin":"http://localhost"}`
- `attestationObject` — CBOR: содержит публичный ключ в COSE-формате, счётчик, rpIdHash

Сервер проверяет challenge, origin, декодирует публичный ключ и сохраняет credential. Возвращает пару JWT.

---

### Вход

**Фаза 1** — клиент → сервер:
```json
{ "handle": "alice" }
```

Сервер находит credentials пользователя, создаёт challenge, возвращает `201`:
```json
{
  "id": "uuid",
  "options": {
    "challenge": "base64url",
    "rpId": "localhost",
    "allowCredentials": [{ "type": "public-key", "id": "base64url" }],
    "userVerification": "preferred",
    "timeout": 60000
  }
}
```

**Фаза 2** — браузер вызывает `navigator.credentials.get(options)`, аутентификатор подписывает данные. Клиент → сервер:
```json
{
  "id": "base64url",
  "rawId": "base64url",
  "type": "public-key",
  "response": {
    "clientDataJSON": "base64url",
    "authenticatorData": "base64url",
    "signature": "base64url",
    "userHandle": "base64url"
  }
}
```

- `clientDataJSON` (после decode): `{"type":"webauthn.get","challenge":"...","origin":"http://localhost"}`
- `authenticatorData`: rpIdHash + flags + counter
- `signature`: подпись над `authenticatorData + SHA256(clientDataJSON)`

Сервер проверяет: challenge совпадает, origin совпадает, подпись валидна, счётчик вырос. Возвращает пару JWT.

---

### JWT

Сервер возвращает два токена:
```json
{
  "access_token": "JWT (Ed25519, TTL 15 мин)",
  "refresh_token": "opaque string (TTL 30 дней)"
}
```

`access_token` содержит claims: `sub` (user_id), `handle`, `exp`.
`refresh_token` хранится в БД, инвалидируется при выходе.

## Шаги разработки

1. `01-api-contract.md` — OpenAPI-спека и README
2. `02-gherkin.md` — компонентные тесты
3. `03-go-server.md` — TDD-цикл: реализация

## Фрейм работы с агентом

См. `AGENTS.md`.
