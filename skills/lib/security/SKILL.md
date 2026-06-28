---
name: security
description: Security as a plan requirement, not an afterthought — data classification, PII minimization and masking, encryption/TLS, authentication and authorization for new entry points, secrets from vault, new network paths via ticket, input validation, security-scan in CI (dependencies/secrets = merge block). Apply during PLANNING (planner), PLAN REVIEW (plan-reviewer), IMPLEMENTATION (implementer), CI/CODE REVIEW (fixer). Does NOT replace module design (program-design).
version: "1.0"
---

# security — security at the plan and implementation stage

Security is designed into the plan, not glued on at the end; static analysis in CI catches the rest. Any change touching data, network paths, or external dependencies MUST pass these checks.

## Mandatory checks

### Data
- **Data classification.** Determine what data the feature handles: PII, sensitive (tokens, keys, special regime), credentials, other. Record it in the plan.
- **Minimization.** MUST NOT log, store, or transmit data beyond what is needed. Sensitive data and secrets MUST NEVER go into logs.
- **Encryption.** Data at rest and in transit MUST be encrypted. Service-to-service transport — TLS only.
- **Masking** of sensitive fields in logs and error messages.

### Access and authentication
- Every new endpoint/consumer — define its authentication and authorization model (who is allowed to call it).
- Least privilege for service accounts.
- No hardcoded secrets. Secrets MUST come only from vault / the platform secret manager.

### Network paths
- Any new network path (see `architecture` skill) = a security ticket to open it on the firewall.
- Document source, destination, port, protocol, and rationale in `network-topology.md`.
- Default-deny; only what is justified gets opened.

### Input and injection
- Validate and sanitize all external input.
- Parameterized DB queries (injection defense).
- Dependency vulnerability defense: security-scan in CI checks dependencies for known vulnerabilities (forbidden/vulnerable libraries = merge block).

### Audit
- Significant operations are logged for audit (who, what, when) — without sensitive content.
- Compliance with applicable data requirements — note in the plan if applicable.

## Output artifact

In `plan.md`, the `## Безопасность` section:

```markdown
## Безопасность

### Классификация данных
- Email-адрес пользователя — PII.
- Тело письма содержит детали заказа — чувствительные данные.

### Проверки
- [x] PII не попадает в логи (маскирование email)
- [x] SMTP-соединение по TLS (порт 587)
- [x] Учётка SMTP из vault, не в коде
- [x] Аудит-лог факта отправки (order_id, timestamp), без тела письма
- [ ] Новый сетевой проход notifications→smtp-gateway — security-тикет SEC-881

### Применимые требования
- Внутреннее правило обработки PII
```

## Self-check checklist

- [ ] Data is classified
- [ ] No PII/secrets/sensitive data in logs
- [ ] Encryption in transit and at rest is ensured
- [ ] Authentication/authorization defined for new entry points
- [ ] Secrets from vault / platform secret manager, no hardcoding
- [ ] New network paths filed as a security ticket
- [ ] External input is validated
- [ ] Audit log present for significant operations
- [ ] security-scan in CI is green (SAST/dependencies/secrets)
